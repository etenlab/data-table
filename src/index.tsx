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
  const [pageNumber, setPageNumber] = useState(0);
  const [search, setSearch] = useState('');
  const pageSize = 15;

  const columnDefs: GridOptions['columnDefs'] = columns.map((c) => ({
    headerName: c.title,
    field: c.field,
  }));

  const [state, setState] = useState<LoadState>({
    error: null,
    loading: false,
    tableData: null,
  });

  const loadIdentifier = identifier;

  const { load } = useMemo(
    () =>
      requestDataLoader({
        identifier: loadIdentifier,
        doRequest: () => {
          return doQuery({ pageNumber, pageSize, search });
        },
        formatResponse: (response) => response,
        initialValue: null,
        onStateChange(output) {
          setState({
            error: output.error,
            loading: output.loading,
            tableData: output.data,
          });
        },
      }),
    [loadIdentifier, doQuery, pageNumber, search]
  );

  useEffect(() => {
    if (!state.loading && !state.error) {
      load();
    }
  }, [state.loading, state.error, load]);

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
                rowData={state.tableData.rows}
                columnDefs={columnDefs}
                pagination={true}
                paginationPageSize={15}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { TableLoader };
