import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

/**
 * Generic, config-driven table shell.
 *
 * - Pure UI: no business logic, no data fetching.
 * - Columns define how headers and cells render.
 *
 * @param {Object} props
 * @param {{ id: string; header: React.ReactNode; align?: 'left'|'right'|'center'; width?: string | number;
 *          renderHeader?: () => React.ReactNode;
 *          renderCell?: (row: any) => React.ReactNode;
 *        }[]} props.columns
 * @param {any[]} props.data
 * @param {boolean} [props.loading]
 * @param {string} [props.emptyMessage]
 * @param {(row: any) => React.Key} [props.getRowId]
 * @param {(row: any) => React.ReactNode} [props.renderActions]
 * @param {boolean} [props.enablePagination]
 * @param {number} [props.page]
 * @param {number} [props.rowsPerPage]
 * @param {(page: number) => void} [props.onPageChange]
 * @param {(rowsPerPage: number) => void} [props.onRowsPerPageChange]
 */
export function CommonTable({
  columns,
  data,
  loading = false,
  emptyMessage = 'No records',
  getRowId,
  renderActions,
  enablePagination = false,
  page = 0,
  rowsPerPage = 10,
  onPageChange,
  onRowsPerPageChange,
}) {
  const hasRows = Array.isArray(data) && data.length > 0;

  const pagedData =
    enablePagination && hasRows
      ? data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
      : data;

  return (
    <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell
                key={col.id}
                align={col.align || 'left'}
                sx={{ width: col.width, fontWeight: 600 }}
              >
                {col.renderHeader ? col.renderHeader() : col.header}
              </TableCell>
            ))}
            {renderActions ? (
              <TableCell align="right" sx={{ fontWeight: 600, width: 120 }}>
                {/* actions */}
              </TableCell>
            ) : null}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length + (renderActions ? 1 : 0)}>
                <Box className="py-5 d-flex justify-content-center">
                  <CircularProgress size={32} />
                </Box>
              </TableCell>
            </TableRow>
          ) : !hasRows ? (
            <TableRow>
              <TableCell colSpan={columns.length + (renderActions ? 1 : 0)}>
                <Box className="py-4 text-center">
                  <Typography variant="body2" color="text.secondary">
                    {emptyMessage}
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          ) : (
            pagedData.map((row) => {
              const key = getRowId ? getRowId(row) : row.id;
              return (
                <TableRow key={key} hover>
                  {columns.map((col) => (
                    <TableCell key={col.id} align={col.align || 'left'}>
                      {col.renderCell ? col.renderCell(row) : row[col.id]}
                    </TableCell>
                  ))}
                  {renderActions ? (
                    <TableCell align="right">{renderActions(row)}</TableCell>
                  ) : null}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {enablePagination && hasRows ? (
        <TablePagination
          component="div"
          count={data.length}
          page={page}
          onPageChange={(_, nextPage) => {
            if (onPageChange) onPageChange(nextPage);
          }}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            const next = parseInt(event.target.value, 10);
            if (onRowsPerPageChange) onRowsPerPageChange(next);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      ) : null}
    </TableContainer>
  );
}

