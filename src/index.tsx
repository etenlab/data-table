import React from 'react';
import { requestDataLoader } from './requestDataLoader';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
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

const TableLoader = (props: {
  identifier: string;
  columns: Field[];
  doQuery: (params: {
    pageSize: number;
    pageNumber: number;
    search: string;
  }) => Promise<{
    totalCount: number | null;
    rows: Object[];
  }>;
}) => {
  const { columns, identifier, doQuery } = props;
  // const [pageNumber, setPageNumber] = useState(0);
  const [search, setSearch] = useState('');
  const viewPageSize = 15;
  const backendPageSize = 40;

  const [viewPageNumber, setViewPageNumber] = useState(0);

  const columnDefs: GridOptions['columnDefs'] = columns.map((c) => ({
    headerName: c.title,
    field: c.field,
  }));

  const [state, setState] = useState<LoadState>({
    error: null,
    loading: false,
    tableData: null,
    nextBucketPageNumber: 0,
  });

  const loadIdentifier = identifier;

  const { load } = useMemo(
    () =>
      requestDataLoader({
        identifier: loadIdentifier,
        doRequest: () => {
          return doQuery({
            pageNumber: state.nextBucketPageNumber,
            pageSize: backendPageSize,
            search,
          });
        },
        formatResponse: (response) => response,
        initialValue: null,
        onStateChange(output) {
          if (!output.data) {
            return;
          }

          setState((state) => ({
            error: output.error,
            loading: output.loading,
            tableData: {
              rows: [...(state.tableData?.rows || []), ...output.data!.rows],
              totalCount:
                state.tableData?.totalCount || output.data!.totalCount,
            },
            nextBucketPageNumber: state.nextBucketPageNumber + 1,
          }));

          return;
        },
      }),
    [loadIdentifier, doQuery, state.nextBucketPageNumber, search]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [style, setStyle] = useState({
    height: '100%',
    width: '100%',
  });

  const setWidthAndHeight = (width: string, height: string) => {
    setStyle({
      width,
      height,
    });
  };

  useLayoutEffect(() => {
    setWidthAndHeight('100%', '100%');
  }, []);

  useEffect(() => {
    const backendHasMoreRows =
      (state.tableData?.totalCount || 0) > (state.tableData?.rows?.length || 0);

    const endReached =
      (viewPageNumber + 1) * viewPageSize >=
      (state.tableData?.rows?.length || 0);

    console.log(
      'endReached',
      endReached,
      'backendHasMoreRows',
      backendHasMoreRows,
      'state.loading',
      state.loading,
      'viewPageNumber',
      viewPageNumber,
      'state.tableData?.rows?.length',
      state.tableData?.rows?.length,
      'state.tableData?.totalCount',
      state.tableData?.totalCount
    );

    if (endReached && backendHasMoreRows && !state.loading && !state.error) {
      load();
    }
  }, [
    viewPageNumber,
    state.loading,
    state.tableData?.rows?.length,
    state.tableData?.totalCount,
    load,
    state.error,
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
