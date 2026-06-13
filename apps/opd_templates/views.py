import json
import os

from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import OPDTemplate
from .serializers import OPDTemplateSerializer

# Canvas dimensions (must match frontend constants)
CANVAS_W = 1024
CANVAS_H = 731


# ─── GET /api/templates ──────────────────────────────────────────────────────
@api_view(["GET"])
@permission_classes([AllowAny])
def list_templates(request):
    """Return all saved OPD templates with their layout JSON."""
    templates = OPDTemplate.objects.all()
    data = OPDTemplateSerializer(templates, many=True).data
    return Response({"templates": data})


# ─── POST /api/templates/update-layout ───────────────────────────────────────
@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([JSONParser])
def update_layout(request):
    """Update (or create) a template's layout JSON."""
    key = request.data.get("key")
    layout = request.data.get("layout")

    if not key or not isinstance(layout, dict) or "fields" not in layout:
        return Response(
            {
                "success": False,
                "error": "Invalid layout payload. 'key' and 'layout.fields' are required.",
            },
            status=400,
        )

    template, _ = OPDTemplate.objects.get_or_create(key=key, defaults={"name": key})
    template.layout = layout
    template.name = template.name or key
    template.save()

    return Response({"success": True})


# ─── POST /admin/templates/upload ─────────────────────────────────────────────
@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def upload_template(request):
    """Create/replace a template with a name, layout JSON and optional background image."""
    name = (request.data.get("templateName") or "").strip()
    layout_raw = request.data.get("layoutJson")
    image_file = request.FILES.get("image")

    if not name or not layout_raw:
        return Response(
            {"success": False, "error": "Missing name or layout JSON"},
            status=400,
        )

    try:
        parsed = json.loads(layout_raw)
    except (json.JSONDecodeError, TypeError):
        return Response({"success": False, "error": "Invalid layout JSON"}, status=400)

    keys = list(parsed.keys())
    if not keys:
        return Response(
            {"success": False, "error": "Layout JSON must have one root key"},
            status=400,
        )

    layout_key = keys[0]
    layout = parsed[layout_key]

    import re
    safe_key = re.sub(r"[^a-z0-9]+", "-", layout_key.lower()).strip("-") or "template"

    template, _ = OPDTemplate.objects.get_or_create(key=safe_key, defaults={"name": name})
    template.name = name
    template.layout = layout
    if image_file:
        template.background_image = image_file
    template.save()

    return Response({"success": True, "key": safe_key})


# ─── GET/POST /api/print ──────────────────────────────────────────────────────
@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def print_slip(request):
    """
    Generate a standalone printable HTML page for the 'single' template.
    Field values come from query params (GET) or body (POST).
    This replicates the Node.js /api/print endpoint exactly.
    """
    try:
        template = OPDTemplate.objects.get(key="single")
    except OPDTemplate.DoesNotExist:
        return HttpResponse(
            'Template layout "single" not found. Save it in the editor first.',
            status=404,
        )

    layout = template.layout or {}
    fields = layout.get("fields", {})
    notes = layout.get("notes", {})
    print_offset_x = layout.get("printOffsetX", 0)
    print_offset_y = layout.get("printOffsetY", 0)

    # Merge GET params and POST body
    values = {}
    values.update(request.GET.dict())
    if hasattr(request, "data") and isinstance(request.data, dict):
        values.update(request.data)

    def make_field_div(name, cfg, text):
        x = cfg.get("x", CANVAS_W / 2)
        y = cfg.get("y", CANVAS_H / 2)
        left = ((x + print_offset_x) / CANVAS_W) * 100
        top = ((y + print_offset_y) / CANVAS_H) * 100
        size = cfg.get("size", 13)
        font_size = f"{(size / 600 * 100):.4f}cqw"
        safe_text = str(text).replace("<", "&lt;").replace(">", "&gt;")
        return (
            f'<div class="field-box" style="left: {left:.4f}%; top: {top:.4f}%; '
            f'font-size: {font_size};">{safe_text}</div>'
        )

    field_html = "\n".join(
        make_field_div(name, cfg, values.get(name, ""))
        for name, cfg in fields.items()
    )

    note_html = "\n".join(
        make_field_div(nid, cfg, cfg.get("text", ""))
        for nid, cfg in notes.items()
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Print OPD</title>
  <style>
    @page {{ size: A4 portrait; margin: 0; marks: none; }}
    html, body {{
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100vh;
      overflow: hidden;
      background: #fff;
    }}
    .opd-generator-wrap {{
      width: 100%;
      max-width: 210mm;
      aspect-ratio: 210 / 297;
      position: relative;
      background: #fff;
      container-type: inline-size;
      margin: 0 auto;
      overflow: hidden;
      page-break-after: avoid;
      page-break-inside: avoid;
    }}
    .field-box {{
      position: absolute;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #000;
      line-height: 1;
    }}
    @media print {{
      body * {{ display: none !important; }}
      .opd-generator-wrap, .opd-generator-wrap * {{ display: block !important; }}
    }}
  </style>
</head>
<body onload="window.print(); setTimeout(() => window.close(), 1000);">
  <div class="opd-generator-wrap">
    {field_html}
    {note_html}
  </div>
</body>
</html>"""

    return HttpResponse(html, content_type="text/html")


# ─── GET /template/:name (background images) ──────────────────────────────────
@api_view(["GET"])
@permission_classes([AllowAny])
def template_bg_image(request, name):
    """Serve a template's background image by key."""
    # Strip -bg suffix if present
    key = name[:-3] if name.endswith("-bg") else name
    try:
        template = OPDTemplate.objects.get(key=key)
    except OPDTemplate.DoesNotExist:
        return HttpResponse("Template image not found", status=404)

    if not template.background_image:
        return HttpResponse("Template image not found", status=404)

    img = template.background_image
    ext = os.path.splitext(img.name)[1].lower()
    content_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
    }
    content_type = content_types.get(ext, "image/png")

    with img.open("rb") as f:
        return HttpResponse(f.read(), content_type=content_type)


# ─── GET /api/health ──────────────────────────────────────────────────────────
@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"ok": True})
