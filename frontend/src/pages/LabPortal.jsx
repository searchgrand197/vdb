import React, { useState, useEffect } from 'react'
import { 
  Beaker, Search, Plus, Filter, FileText, Printer, CheckCircle, 
  Clock, AlertTriangle, User, Calendar, LogOut, ChevronRight,
  Clipboard, Activity, Microscope, ShieldCheck, Download,
  Settings, Layers, Monitor, ChevronDown, List
} from 'lucide-react'
import api from '../api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const STATUS_COLORS = {
  draft: 'bg-amber-100 text-amber-700 border-amber-200',
  final: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-100 text-rose-700 border-rose-200'
}

export default function LabPortal() {
  const [activeTab, setActiveTab] = useState('queue')
  const [reports, setReports] = useState([])
  const [tests, setTests] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [printingReport, setPrintingReport] = useState(null)

  useEffect(() => {
    fetchInitialData()
  }, [])

  async function fetchInitialData() {
    setLoading(true)
    try {
      const [rResp, tResp, cResp] = await Promise.all([
        api.get('/lab/reports/?limit=100'),
        api.get('/lab/tests/?limit=500'),
        api.get('/lab/categories/?limit=50')
      ])
      setReports(rResp.data?.data || rResp.data?.results || [])
      setTests(tResp.data?.data || tResp.data?.results || [])
      setCategories(cResp.data?.data || cResp.data?.results || [])
    } catch (err) {
      toast.error('Laboratory network error')
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    localStorage.removeItem('role')
    localStorage.removeItem('user')
    window.location.href = '/login'
  }

  return (
    <div className="h-screen w-screen flex bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Left ERP Sidebar */}
      <aside className="w-64 bg-[#1e293b] flex flex-col shrink-0">
        <div className="p-6 border-b border-white/5">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold">V</div>
              <div>
                 <h1 className="text-sm font-bold text-white tracking-tight uppercase">Vardaan Lab</h1>
                 <p className="text-[10px] text-indigo-400 font-medium uppercase tracking-wider">Clinical LIS v2.4</p>
              </div>
           </div>
        </div>

        <nav className="flex-1 py-6 flex flex-col gap-1">
           {[
             { id: 'queue', label: 'Patient Queue', icon: Activity },
             { id: 'tests', label: 'Test Master', icon: Beaker },
             { id: 'categories', label: 'Lab Categories', icon: Layers },
             { id: 'reports', label: 'Final Reports', icon: FileText },
             { id: 'settings', label: 'Lab Setup', icon: Settings }
           ].map(item => (
             <button
               key={item.id}
               onClick={() => setActiveTab(item.id)}
               className={`flex items-center gap-3 px-6 py-3 text-sm font-semibold transition-all border-l-4 ${
                 activeTab === item.id 
                  ? 'bg-indigo-600/10 text-indigo-400 border-indigo-600' 
                  : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'
               }`}
             >
               <item.icon size={18} />
               {item.label}
             </button>
           ))}
        </nav>

        <div className="p-6 border-t border-white/5">
           <button onClick={handleLogout} className="flex items-center gap-3 text-slate-500 hover:text-rose-400 text-sm font-semibold w-full">
              <LogOut size={18} />
              Exit Portal
           </button>
        </div>
      </aside>

      {/* Main ERP Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
         {/* Top Monitor Header */}
         <header className="h-14 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-6 text-xs font-bold text-slate-400 uppercase tracking-widest">
               <span className="flex items-center gap-2 text-indigo-600"><Activity size={14} /> System Online</span>
               <span className="text-slate-200">|</span>
               <span>Terminal_ID: LAB_01</span>
               <span className="text-slate-200">|</span>
               <span className="text-emerald-600">Calibration: Active</span>
            </div>
            <div className="flex items-center gap-4">
               <div className="text-right">
                  <p className="text-[9px] font-bold text-slate-400 uppercase leading-none">Logged Technologist</p>
                  <p className="text-xs font-bold text-slate-900 mt-1 uppercase italic">Chief Pathologist</p>
               </div>
               <div className="w-8 h-8 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400">
                  <Monitor size={16} />
               </div>
            </div>
         </header>

         <main className="flex-1 overflow-hidden p-8">
            {activeTab === 'queue' && <LabQueueView reports={reports} fetchReports={fetchInitialData} tests={tests} setPrintingReport={setPrintingReport} />}
            {activeTab === 'tests' && <TestMasterView tests={tests} categories={categories} fetchTests={fetchInitialData} />}
            {activeTab === 'categories' && <CategoryMasterView categories={categories} />}
            {activeTab === 'reports' && <FinalReportsJournal reports={reports} setPrintingReport={setPrintingReport} />}
            {activeTab === 'settings' && <div className="p-10 text-center text-slate-300 font-bold uppercase italic border-4 border-dashed border-slate-100 rounded-3xl">System Configurations Restricted to Super-User</div>}
         </main>
      </div>

      {printingReport && (
        <ProfessionalReportPrint report={printingReport} onClose={() => setPrintingReport(null)} />
      )}
    </div>
  )
}

function LabQueueView({ reports, fetchReports, tests, setPrintingReport }) {
  const [search, setSearch] = useState('')
  const [showReg, setShowReg] = useState(false)
  const [selectedReport, setSelectedReport] = useState(null)

  const filtered = reports.filter(r => 
    r.patient_details?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.lab_no?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="h-full grid grid-cols-12 gap-8 overflow-hidden">
      {/* Left Monitoring Grid */}
      <div className="col-span-8 flex flex-col gap-6 min-h-0">
          <div className="flex items-center justify-between shrink-0">
             <div>
                <h2 className="text-lg font-bold text-slate-900 uppercase italic leading-none tracking-tight">Active Diagnostics Monitor</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Real-time Patient Processing List</p>
             </div>
             <button onClick={() => setShowReg(true)} className="bg-indigo-600 hover:bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest shadow-xl shadow-indigo-900/20 transition-all flex items-center gap-2">
                <Plus size={16} /> Register Collection
             </button>
          </div>

          <div className="relative shrink-0">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
             <input 
                type="text" 
                placeholder="SEARCH MONITOR BY NAME / LAB_ID / UHID..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 pl-12 pr-4 py-3 rounded-xl text-xs font-bold uppercase focus:border-indigo-500 outline-none transition-all shadow-sm italic"
             />
          </div>

          <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
             <div className="flex-1 overflow-y-auto scrollbar-thin">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-slate-50/50 text-[10px] font-bold uppercase italic tracking-widest text-slate-400 border-b border-slate-100 sticky top-0 bg-white">
                         <th className="px-8 py-5">Diagnostic Profile</th>
                         <th className="px-8 py-5 text-center">Reference ID</th>
                         <th className="px-8 py-5 text-center">Status</th>
                         <th className="px-8 py-5 text-right">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {filtered.map(report => (
                        <tr key={report.id} onClick={() => setSelectedReport(report)} className={`group hover:bg-indigo-50/50 cursor-pointer transition-all ${selectedReport?.id === report.id ? 'bg-indigo-50' : ''}`}>
                           <td className="px-8 py-5">
                              <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 bg-slate-100 text-slate-400 font-bold flex items-center justify-center rounded-lg text-xs group-hover:bg-indigo-600 group-hover:text-white transition-all uppercase">
                                    {report.patient_details?.first_name?.[0]}
                                 </div>
                                 <div>
                                    <p className="text-sm font-bold text-slate-900">
                                       {report.patient_details?.first_name} {report.patient_details?.last_name}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase italic mt-0.5">{report.patient_details?.uhid} · {report.patient_details?.age || '--'}Y / {report.patient_details?.gender}</p>
                                 </div>
                              </div>
                           </td>
                           <td className="px-8 py-5 text-center font-mono text-xs font-bold text-indigo-700">#{report.lab_no}</td>
                           <td className="px-8 py-5 text-center">
                              <span className={`px-4 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border border-transparent flex items-center justify-center gap-1.5 w-fit mx-auto ${STATUS_COLORS[report.status]}`}>
                                 {report.status}
                              </span>
                           </td>
                           <td className="px-8 py-5 text-right">
                              <button onClick={(e) => { e.stopPropagation(); setPrintingReport(report) }} className="p-2.5 text-slate-200 hover:text-indigo-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-indigo-100">
                                 <Printer size={18} />
                              </button>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
      </div>

      {/* Right Result Entry Column */}
      <div className="col-span-4 min-h-0">
          {selectedReport ? (
             <AdvancedResultEntry report={selectedReport} fetchReports={fetchReports} />
          ) : (
            <div className="h-full bg-slate-100/50 border border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-center p-10 grayscale opacity-40">
               <Clipboard size={48} className="text-slate-300 mb-6" />
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">Awaiting Selection</h4>
               <p className="text-[10px] text-slate-400 font-medium mt-2 leading-relaxed">Select a patient from the queue to start entering clinical diagnostic values.</p>
            </div>
          )}
      </div>

      {showReg && <SampleRegistrationModal tests={tests} onClose={() => setShowReg(false)} fetchReports={fetchReports} />}
    </div>
  )
}

function AdvancedResultEntry({ report, fetchReports }) {
  const [results, setResults] = useState(report.results || [])
  const [submitting, setSubmitting] = useState(false)

  async function updateVal(id, field, value) {
    try {
      await api.patch(`/lab/results/${id}/`, { [field]: value })
      setResults(results.map(r => r.id === id ? { ...r, [field]: value } : r))
    } catch {}
  }

  async function handleFinalize() {
    if (!window.confirm('CERTIFY AS FINAL? Once finalized, report will be locked for editing.')) return
    setSubmitting(true)
    try {
      await api.patch(`/lab/reports/${report.id}/`, { 
        status: 'final', 
        reported_at: new Date().toISOString(),
        validation_status: 'Certified by Pathologist'
      })
      toast.success('Clinical Certification Complete')
      fetchReports()
    } catch {
      toast.error('System synchronization error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-full bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-300">
       <div className="p-8 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between mb-3">
             <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest italic flex items-center gap-2">
                <ShieldCheck size={14} /> Clinical Registry
             </span>
             <span className={`px-3 py-1 rounded text-[9px] font-bold uppercase tracking-widest border ${STATUS_COLORS[report.status]}`}>{report.status}</span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 uppercase italic tracking-tight">
             {report.patient_details?.first_name} {report.patient_details?.last_name}
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 italic tracking-widest">ID NO: #{report.lab_no} · GENDER: {report.patient_details?.gender}</p>
       </div>

       <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
          {results.map((res, idx) => (
             <div key={res.id} className="space-y-4">
                <div className="flex items-center justify-between">
                   <p className="text-xs font-bold text-slate-900 uppercase italic tracking-tighter">{res.test_name}</p>
                   <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                         type="checkbox" 
                         checked={res.is_abnormal} 
                         onChange={e => updateVal(res.id, 'is_abnormal', e.target.checked)}
                         className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-100 rounded-full peer peer-checked:bg-rose-100 border border-slate-200 peer-checked:border-rose-200 transition-colors flex items-center px-0.5 after:content-[''] after:w-3 after:h-3 after:bg-slate-300 peer-checked:after:bg-rose-500 after:rounded-full after:transition-all peer-checked:after:translate-x-4" />
                      <span className={`text-[10px] font-bold uppercase italic transition-colors ${res.is_abnormal ? 'text-rose-600' : 'text-slate-400'}`}>
                         {res.is_abnormal ? 'CRITICAL' : 'NORMAL'}
                      </span>
                   </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="relative">
                      <input 
                         type="text" 
                         value={res.result_value} 
                         onChange={e => updateVal(res.id, 'result_value', e.target.value)}
                         className={`w-full bg-slate-50 border px-4 py-2.5 rounded-lg text-sm font-bold italic transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${res.is_abnormal ? 'border-rose-500 text-rose-600 bg-rose-50' : 'border-slate-100 text-slate-900'}`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-300 uppercase">{res.test_unit}</span>
                   </div>
                   <div className="bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-lg text-[10px] font-bold text-slate-400 italic flex items-center truncate">
                      REF: {res.test_ref || 'NO RANGE'}
                   </div>
                </div>
             </div>
          ))}
       </div>

       {report.status !== 'final' && (
         <div className="p-8 border-t border-slate-100 shrink-0">
            <button 
              onClick={handleFinalize}
              disabled={submitting}
              className="w-full bg-indigo-600 hover:bg-slate-900 text-white rounded-lg py-4 font-bold text-xs uppercase tracking-widest shadow-xl shadow-indigo-900/20 transition-all flex items-center justify-center gap-2 group"
            >
               {submitting ? 'PROCESSING...' : <>CERTIFY REPORT DATA <CheckCircle size={18} /></>}
            </button>
         </div>
       )}
    </div>
  )
}

function SampleRegistrationModal({ tests, onClose, fetchReports }) {
  const [ptSearch, setPtSearch] = useState('')
  const [ptResults, setPtResults] = useState([])
  const [selectedPt, setSelectedPt] = useState(null)
  const [selectedTests, setSelectedTests] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (ptSearch.length < 2) { setPtResults([]); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/patients/?search=${ptSearch}&limit=5`)
        setPtResults(data?.data || [])
      } catch {}
    }, 400)
    return () => clearTimeout(t)
  }, [ptSearch])

  async function handleSubmit() {
    if (!selectedPt) { toast.error('Identify patient first'); return }
    if (!selectedTests.length) { toast.error('Assign diagnostic panel'); return }
    
    setSubmitting(true)
    try {
      const { data: rData } = await api.post('/lab/reports/', {
        patient: selectedPt.id,
        collected_at: new Date().toISOString()
      })
      const reportId = rData?.data?.id || rData?.id
      await Promise.all(selectedTests.map(tId => 
        api.post('/lab/test-results/', { report: reportId, test: tId })
      ))
      toast.success('Collection logged successfully')
      fetchReports()
      onClose()
    } catch {
      toast.error('Processing error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-sm flex items-center justify-center p-8 z-[100] animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
           <div>
              <h3 className="text-xl font-bold text-slate-900 uppercase italic leading-none tracking-tight">Register New Clinical Panel</h3>
              <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                 <Microscope size={14} /> Diagnostic Master Intake
              </p>
           </div>
           <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-900"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-hidden flex gap-8 p-8">
           {/* Left: Patient Search */}
           <div className="w-1/2 flex flex-col gap-6">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Phase 1: Human Identification</label>
              {selectedPt ? (
                 <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl flex items-center justify-between">
                    <div>
                       <p className="text-base font-bold text-slate-900 uppercase italic leading-none">{selectedPt.first_name} {selectedPt.last_name}</p>
                       <p className="text-[10px] text-indigo-600 font-bold uppercase mt-2 tracking-widest">{selectedPt.uhid} · {selectedPt.phone}</p>
                    </div>
                    <button onClick={() => setSelectedPt(null)} className="text-[10px] font-bold text-indigo-400 uppercase underline italic">Change</button>
                 </div>
              ) : (
                <div className="relative group">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                   <input 
                      type="text" 
                      placeholder="NAME / UHID / MOBILE RECORD..." 
                      value={ptSearch}
                      onChange={e => setPtSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 pl-12 pr-4 py-3 rounded-xl text-xs font-bold uppercase focus:border-indigo-500 outline-none transition-all italic"
                   />
                   {ptResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-2xl rounded-xl z-50 overflow-hidden divide-y">
                         {ptResults.map(p => (
                            <button key={p.id} onClick={() => { setSelectedPt(p); setPtResults([]) }} className="w-full text-left px-5 py-4 hover:bg-slate-50 flex flex-col transition-colors">
                               <span className="text-sm font-bold text-slate-800 uppercase italic tracking-tight">{p.first_name} {p.last_name}</span>
                               <span className="text-[10px] text-slate-400 font-bold uppercase italic mt-1 tracking-widest">{p.uhid} · {p.phone}</span>
                            </button>
                         ))}
                      </div>
                   )}
                </div>
              )}
              <div className="flex-1 bg-slate-50/50 border border-dashed border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center text-center">
                 <Activity size={32} className="text-slate-300 mb-4" />
                 <p className="text-[10px] text-slate-400 uppercase font-bold italic leading-relaxed">Ensure sample integrity by cross-referencing patient ID bracelets before collection authorization.</p>
              </div>
           </div>

           {/* Right: Test Selection */}
           <div className="w-1/2 flex flex-col gap-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Phase 2: Service Allocation ({selectedTests.length})</label>
              <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-y-auto scrollbar-thin divide-y">
                 {tests.map(test => (
                    <label key={test.id} className="flex items-center justify-between p-4 hover:bg-slate-50 cursor-pointer transition-colors group">
                       <div className="flex-1">
                          <p className={`text-xs font-bold uppercase tracking-tight italic ${selectedTests.includes(test.id) ? 'text-indigo-600' : 'text-slate-800'}`}>{test.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase italic">{test.category_name}</p>
                       </div>
                       <input type="checkbox" checked={selectedTests.includes(test.id)} onChange={() => {
                          if (selectedTests.includes(test.id)) setSelectedTests(selectedTests.filter(x => x !== test.id))
                          else setSelectedTests([...selectedTests, test.id])
                       }} className="sr-only" />
                       <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${selectedTests.includes(test.id) ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-100' : 'border-slate-200 group-hover:border-indigo-200'}`}>
                          {selectedTests.includes(test.id) && <Check className="text-white" size={12} strokeWidth={4} />}
                       </div>
                    </label>
                 ))}
              </div>
           </div>
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
           <div className="text-[10px] font-bold text-slate-400 uppercase italic tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" /> Finalizing Collection Record
           </div>
           <button 
              onClick={handleSubmit} 
              disabled={submitting}
              className="bg-indigo-600 hover:bg-slate-900 text-white px-10 py-4 rounded-xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-indigo-900/20 transition-all active:scale-95 disabled:bg-slate-300"
           >
              {submitting ? 'PROCESSING...' : 'AUTHORIZE INTAKE'}
           </button>
        </div>
      </div>
    </div>
  )
}

function TestMasterView({ tests, categories, fetchTests }) {
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const filtered = tests.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden animate-in fade-in duration-300">
       <div className="flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight italic leading-none">Diagnostic Master Catalog</h2>
            <p className="text-xs text-slate-400 font-semibold mt-1 uppercase tracking-widest">Global Investigative Repository</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-900/10">Registry New Entry</button>
       </div>

       <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/30">
             <Search size={16} className="text-slate-400" />
             <input value={search} onChange={e => setSearch(e.target.value)} placeholder="FILTER MASTER LIST BY NAME / CODE / CATEGORY..." className="flex-1 bg-transparent text-xs font-bold outline-none uppercase italic text-slate-600" />
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
             <table className="w-full text-left">
                <thead>
                   <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 sticky top-0 bg-white">
                      <th className="px-8 py-5">Diagnostic Detail / Code</th>
                      <th className="px-8 py-5">Clinical Unit</th>
                      <th className="px-8 py-5">Biological Ref.</th>
                      <th className="px-8 py-5 text-right">Premium Rate</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-semibold text-xs italic uppercase text-slate-600">
                   {filtered.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                         <td className="px-8 py-5">
                            <p className="text-slate-900 font-bold">{t.name}</p>
                            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider italic">CAT: {t.category_name} · REF: {t.code || '--'}</p>
                         </td>
                         <td className="px-8 py-5">
                            <span className="text-[10px] font-bold text-indigo-400 border border-indigo-100 px-3 py-1 rounded bg-indigo-50/50">{t.unit || '---'}</span>
                         </td>
                         <td className="px-8 py-5 font-sans not-italic text-slate-400 text-[11px] font-bold tracking-widest">{t.reference_range}</td>
                         <td className="px-8 py-5 text-right text-slate-900 font-bold italic text-sm">₹{Number(t.price).toLocaleString()}</td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
       </div>

       {showAdd && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 z-[100] animate-in fade-in duration-300">
             <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
                <div className="bg-[#1e293b] text-white p-6 flex items-center justify-between">
                   <h3 className="text-sm font-bold uppercase tracking-widest italic">New Parameter Registration</h3>
                   <button onClick={() => setShowAdd(false)}><X size={20} /></button>
                </div>
                <div className="p-8 space-y-6">
                   <div className="space-y-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Diagnostic MetaData</p>
                      <input className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-lg text-sm font-bold outline-none uppercase" placeholder="Test Name (e.g. Vitamin B12)" />
                      <div className="grid grid-cols-2 gap-4">
                         <input className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-lg text-sm font-bold outline-none uppercase" placeholder="Unit (pg/mL)" />
                         <input className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-lg text-sm font-bold outline-none uppercase" placeholder="Rate (₹)" />
                      </div>
                      <textarea className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-lg text-sm font-bold outline-none uppercase min-h-[100px]" placeholder="Reference Range Standards..." />
                   </div>
                   <button onClick={() => { setShowAdd(false); toast.success('Entry logged in master catalog') }} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest">Commit Catalog Entry</button>
                </div>
             </div>
          </div>
       )}
    </div>
  )
}

function CategoryMasterView({ categories }) {
  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden animate-in fade-in duration-300">
       <div className="shrink-0">
          <h2 className="text-lg font-bold text-slate-900 uppercase italic tracking-tight">Clinical Category Registry</h2>
          <p className="text-xs text-slate-400 font-semibold mt-1 uppercase tracking-widest">Grouping of lab test parameters</p>
       </div>
       <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden overflow-y-auto scrollbar-thin">
          <table className="w-full text-left">
             <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 sticky top-0 bg-white">
                   <th className="px-8 py-5">S.N</th>
                   <th className="px-8 py-5">Category Name</th>
                   <th className="px-8 py-5 text-right">Action</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-50 text-xs italic uppercase font-bold text-slate-600">
                {categories.map((c, idx) => (
                   <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-8 py-5 text-slate-300">{idx + 1}</td>
                      <td className="px-8 py-5 text-slate-900">{c.name}</td>
                      <td className="px-8 py-5 text-right text-indigo-400">Edit</td>
                   </tr>
                ))}
             </tbody>
          </table>
       </div>
    </div>
  )
}

function FinalReportsJournal({ reports, setPrintingReport }) {
  const finals = reports.filter(r => r.status === 'final')
  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden animate-in fade-in duration-300">
       <div className="shrink-0">
          <h2 className="text-lg font-bold text-slate-900 uppercase italic tracking-tight">Final Published Reports Journal</h2>
          <p className="text-xs text-slate-400 font-semibold mt-1 uppercase tracking-widest">Historical record of all certified clinical reports</p>
       </div>
       <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden overflow-y-auto scrollbar-thin">
          <table className="w-full text-left">
             <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 sticky top-0 bg-white">
                   <th className="px-8 py-5">Report ID</th>
                   <th className="px-8 py-5">Patient Detail</th>
                   <th className="px-8 py-5 text-center">Certified At</th>
                   <th className="px-8 py-5 text-right">Actions</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-50 text-xs italic uppercase font-bold text-slate-600">
                {finals.map(r => (
                   <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-8 py-5 text-indigo-600">#{r.lab_no}</td>
                      <td className="px-8 py-5">
                         <p className="text-slate-900 font-bold">{r.patient_details?.first_name} {r.patient_details?.last_name}</p>
                         <p className="text-[10px] text-slate-400">{r.patient_details?.uhid}</p>
                      </td>
                      <td className="px-8 py-5 text-center text-slate-400 font-sans not-italic">{r.reported_at ? format(new Date(r.reported_at), 'dd-MM-yyyy HH:mm') : 'N/A'}</td>
                      <td className="px-8 py-5 text-right">
                         <button onClick={() => setPrintingReport(r)} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                            <Printer size={18} />
                         </button>
                      </td>
                   </tr>
                ))}
             </tbody>
          </table>
       </div>
    </div>
  )
}

function ProfessionalReportPrint({ report, onClose }) {
  const groupedResults = report.results?.reduce((acc, res) => {
    const cat = res.category_name || 'GENERAL INVESTIGATIONS'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(res)
    return acc
  }, {}) || {}

  useEffect(() => {
    if (report) {
       setTimeout(() => { window.print(); onClose(); }, 600)
    }
  }, [report])

  if (!report) return null

  return (
    <div className="fixed inset-0 bg-white z-[200] overflow-y-auto print:static">
      <div className="max-w-[210mm] mx-auto p-12 text-slate-900 font-sans print:p-0">
        {/* Simple Professional Header */}
        <div className="flex flex-col border-b-[6px] border-indigo-900 pb-10 mb-12">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 bg-indigo-900 text-white flex items-center justify-center rounded-[12px] font-black text-4xl italic">V</div>
                 <div>
                    <h1 className="text-4xl font-black text-indigo-900 tracking-tighter uppercase italic leading-none">Vardaan Lab</h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] italic mt-2">ISO 9001:2015 ACCREDITED DIAGNOSTIC CENTRE</p>
                 </div>
              </div>
              <div className="text-right text-[10px] text-slate-400 font-bold uppercase tracking-widest space-y-1">
                 <p className="text-slate-900 font-black italic mb-1">Vardaan Healthcare Towers, Block-A</p>
                 <p>Health Avenue, Medical City, New Delhi - 110001</p>
                 <p>GSTIN: 06ACIPS2870G1ZF | PH: +91 99999 88888</p>
                 <p className="text-indigo-600 font-black italic">www.vardaanhealthcare.com</p>
              </div>
           </div>
        </div>

        {/* Patient Clinical Info */}
        <div className="grid grid-cols-2 gap-x-12 p-8 border-[3px] border-slate-100 rounded-[32px] mb-12 text-[12px] font-bold uppercase italic tracking-tight italic">
           <div className="space-y-4">
              <p className="flex justify-between border-b border-slate-50 pb-2"><span className="not-italic text-[9px] text-slate-300">Patient:</span> <span>{report.patient_details?.first_name} {report.patient_details?.last_name}</span></p>
              <p className="flex justify-between border-b border-slate-50 pb-2"><span className="not-italic text-[9px] text-slate-300">Lab ID:</span> <span>#{report.lab_no}</span></p>
              <p className="flex justify-between"><span className="not-italic text-[9px] text-slate-300">Collected:</span> <span>{report.collected_at ? format(new Date(report.collected_at), 'dd-MM-yyyy HH:mm') : '--'}</span></p>
           </div>
           <div className="space-y-4">
              <p className="flex justify-between border-b border-slate-50 pb-2"><span className="not-italic text-[9px] text-slate-300">Age/Sex:</span> <span>{report.patient_details?.age || '--'} Y / {report.patient_details?.gender}</span></p>
              <p className="flex justify-between border-b border-slate-50 pb-2"><span className="not-italic text-[9px] text-slate-300">Reported:</span> <span>{report.reported_at ? format(new Date(report.reported_at), 'dd-MM-yyyy HH:mm') : '--'}</span></p>
              <p className="flex justify-between text-indigo-600"><span className="not-italic text-[9px] text-slate-300 tracking-widest">MD:</span> <span>{report.doctor_details?.name || 'SELF REFERRAL'}</span></p>
           </div>
        </div>

        <h2 className="text-center font-black uppercase tracking-[0.6em] text-lg border-b-[3px] border-black pb-2 mb-10 italic">Diagnostics Intelligence Report</h2>

        {/* Investigative Results */}
        <div className="space-y-16 min-h-[400px]">
           {Object.entries(groupedResults).map(([cat, resList]) => (
              <div key={cat} className="space-y-6">
                 <p className="font-black text-sm uppercase tracking-[0.3em] text-indigo-950 bg-slate-50 px-5 py-2.5 rounded-lg border-l-[6px] border-indigo-900 italic">{cat}</p>
                 <table className="w-full text-left">
                    <thead>
                       <tr className="border-b-2 border-black text-[10px] font-bold uppercase tracking-widest text-slate-400 italic">
                          <th className="py-4">Investigation Parameter</th>
                          <th className="py-4 text-center w-32">Observed</th>
                          <th className="py-4 text-center w-24">Unit</th>
                          <th className="py-4 text-right">Referance Range</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold uppercase italic italic">
                       {resList.map(res => (
                          <tr key={res.id} className="text-[13px]">
                             <td className="py-5 text-slate-900 tracking-tighter leading-snug">{res.test_name}</td>
                             <td className={`py-5 text-center text-lg tracking-tighter ${res.is_abnormal ? 'text-rose-600 bg-rose-50 rounded shadow-inner scale-110 px-4' : 'text-slate-900'}`}>
                                {res.result_value || 'PENDING'}
                             </td>
                             <td className="py-5 text-center text-slate-400 text-[10px] tracking-widest">{res.test_unit}</td>
                             <td className="py-5 text-right text-slate-400 text-[11px] font-sans not-italic tracking-widest">{res.test_ref}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           ))}
        </div>

        {/* Final Certification Footer */}
        <div className="mt-40 grid grid-cols-2 gap-20">
           <div className="border-t-[3px] border-slate-100 pt-6">
              <p className="text-[11px] font-bold italic text-slate-300 uppercase tracking-[0.3em] mb-8">Authorized Laboratory Reviewer Case Node: MC_33</p>
              <p className="text-[9px] font-bold text-slate-200 uppercase tracking-widest">End of report intelligence journal</p>
           </div>
           <div className="relative pt-6 border-t-[3px] border-indigo-900 text-center">
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 opacity-5 scale-150"><Microscope size={80} /></div>
              <p className="text-[14px] font-black text-indigo-950 uppercase italic tracking-widest mb-1">Dr. Vardaan MD (PATH)</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chief Clinical Pathologist</p>
              <p className="text-[9px] font-bold text-indigo-600 mt-1 uppercase tracking-[0.2em]">Reg No: MC-112233</p>
           </div>
        </div>

        <div className="mt-20 border-t border-slate-50 pt-8 text-center">
           <p className="text-[9px] font-bold text-slate-200 uppercase tracking-[0.6em] italic">Electronic Clinical Document - Signature Not Mandatory for Validity</p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .print\:static, .print\:static * { visibility: visible; }
          .print\:static { position: absolute; left: 0; top: 0; width: 100%; height: auto; }
          @page { margin: 15mm; size: A4; }
        }
      `}} />
    </div>
  )
}
