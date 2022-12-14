import React from 'react';
import { requestDataLoader } from './requestDataLoader';
import { useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { GridOptions } from 'ag-grid-community';
import 'ag-grid-community/styles//ag-grid.css';
import 'ag-grid-community/styles//ag-theme-alpine.css';

interface Field {
  title: string;
  field: string;
}

interface LoadState {
  error: Error | null;
  loading: boolean;
  tableData: null | {
    rows: any[];
    totalCount: number | null;
  };
  nextBucketPageNumber: number;
}

const DEFAULT_BACKEND_PAGE_SIZE = 100;

export interface DataLoaderProps {
  columns: Field[];
  doQuery: (params: {
    pageSize: number;
    pageNumber: number;
    search: string;
  }) => Promise<{
    totalCount: number | null;
    rows: Object[];
  }>;
  /**
   * Start loading all rows immediately
   */
  eager?: boolean;
  /**
   * Page size used in backend queries
   */
  loadPageSize?: number;
}

const TableLoader = (props: DataLoaderProps) => {
  const { columns, doQuery, eager, loadPageSize } = props;
  const [search, setSearch] = useState('');
  const viewPageSize = 15;
  const backendPageSize = loadPageSize || DEFAULT_BACKEND_PAGE_SIZE;

  const loading = useRef(false);

  const [viewPageNumber, setViewPageNumber] = useState(0);

  const columnDefs: GridOptions['columnDefs'] = columns.map((c) => ({
    headerName: c.title,
    field: c.field,
  }));

  const [style, setStyle] = useState({
    height: '100%',
    width: '100%',
  });

  // useLayoutEffect(() => {
  //   setStyle({
  //     width: '100%',
  //     height: '100%',
  //   });
  // }, []);

  const [state, setState] = useState<LoadState>({
    error: null,
    loading: false,
    tableData: null,
    nextBucketPageNumber: 0,
  });

  const { load } = useMemo(
    () =>
      requestDataLoader({
        doRequest: () => {
          loading.current = true;

          return doQuery({
            pageNumber: state.nextBucketPageNumber,
            pageSize: backendPageSize,
            search,
          });
        },
        formatResponse: (response) => response,
        initialValue: null,
        onStateChange(output) {
          loading.current = false;

          if (!output.data) {
            return;
          }

          setState((state) => ({
            error: output.error,
            loading: output.loading,
            tableData: (output.data || state.tableData) && {
              rows: [
                ...(state.tableData?.rows || []),
                ...(output.data?.rows || []),
              ],
              totalCount:
                state.tableData?.totalCount || output.data?.totalCount || null,
            },
            nextBucketPageNumber: state.nextBucketPageNumber + 1,
          }));

          return;
        },
      }),
    [doQuery, state.nextBucketPageNumber, backendPageSize, search]
  );

  useEffect(() => {
    const backendHasMoreRows =
      (state.tableData?.totalCount || 0) > (state.tableData?.rows?.length || 0);

    const endReached =
      (viewPageNumber + 1) * viewPageSize >=
      (state.tableData?.rows?.length || 0);

    const loadNext = (endReached || eager) && backendHasMoreRows;

    if (
      !state.tableData &&
      !state.loading &&
      !state.error &&
      !loading.current
    ) {
      load();
      return;
    }

    if (loadNext && !state.loading && !state.error && !loading.current) {
      load();
    }
  }, [
    viewPageNumber,
    state.loading,
    state.tableData?.rows?.length,
    state.tableData?.totalCount,
    load,
    state.error,
    eager,
    state.tableData,
  ]);

  const rowsWithPlaceholders = useMemo(() => {
    const missingRowsCount =
      (state.tableData?.totalCount || 0) - (state.tableData?.rows?.length || 0);

    const fakeRows = Array(Math.max(0, missingRowsCount)).fill(undefined);

    return [...(state.tableData?.rows || []), ...fakeRows];
  }, [state.tableData?.totalCount, state.tableData?.rows]);

  return (
    <div style={{ height: '100%' }}>
      {state.loading && <div>Loading...</div>}
      {state.error && <div>{state.error.message}</div>}
      {state.tableData && (
        <div id="1" style={{ height: '100%' }}>
          <div
            className="ag-theme-alpine"
            style={{ height: 'calc(100% - 25px)' }}
          >
            <div style={style}>
              <AgGridReact
                rowSelection="multiple"
                rowData={rowsWithPlaceholders}
                columnDefs={columnDefs}
                pagination={true}
                paginationPageSize={viewPageSize}
                onPaginationChanged={(e) => {
                  const currentPage = e.api.paginationGetCurrentPage();
                  setViewPageNumber(currentPage);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { TableLoader };
