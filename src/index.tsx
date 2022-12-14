import React from 'react';
import type { ApolloClient } from 'apollo-client';
import { requestDataLoader } from './requestDataLoader';
import { useEffect, useMemo, useState } from 'react';
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
  identifier?: string;
  title: string;
  columns: Field[];
  doQuery: (params: { page: number; search: string }) => Promise<{
    totalCount: number | null;
    rows: Object[];
  }>;
}) => {
  const { columns, identifier, title, doQuery } = props;
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  const [state, setState] = useState<LoadState>({
    error: null,
    loading: false,
    tableData: null,
  });

  const loadIdentifier = identifier || title;

  const { load } = useMemo(
    () =>
      requestDataLoader({
        identifier: loadIdentifier,
        doRequest: () => {
          return doQuery({ page, search });
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
    [loadIdentifier, doQuery, page, search]
  );

  useEffect(() => {
    if (!state.loading && !state.error) {
      load();
    }
  }, [state.loading, state.error, load]);

  return (
    <div>
      <div>
        {state.loading && <div>Loading...</div>}
        {state.error && <div>{state.error.message}</div>}
        {state.tableData && (
          <TableView columns={columns} rows={state.tableData.rows} />
        )}
      </div>
    </div>
  );
};

const TableView = (props: { rows: Object[]; columns: Field[] }) => {
  const columnDefs: GridOptions['columnDefs'] = props.columns.map((c) => ({
    headerName: c.title,
    field: c.field,
  }));

  const rowData = props.rows;

  return (
    <div
      className="ag-theme-alpine"
      style={{ width: '100%', height: '1000px' }}
    >
      <AgGridReact rowData={rowData} columnDefs={columnDefs} />
    </div>
  );
};

export { TableLoader };
