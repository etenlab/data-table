import React from 'react';
import { requestDataLoader } from './requestDataLoader';
import { useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { GridOptions } from 'ag-grid-community';
import 'ag-grid-community/styles//ag-grid.css';
import 'ag-grid-community/styles//ag-theme-alpine.css';

import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  InputAdornment,
  LinearProgress,
  TextField,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

interface Field {
  title: string;
  field: string;
}

interface LoadState {
  error: string | null;
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
    sortable: true,
  }));

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
          return doQuery({
            pageNumber: state.nextBucketPageNumber,
            pageSize: backendPageSize,
            search,
          });
        },
        formatResponse: (response) => response,
        initialValue: null,
        onStateChange(output) {
          loading.current = output.loading;

          setState((state) => ({
            error: output.error,
            loading: output.loading,
            tableData: (output.data || state.tableData) && {
              rows: [
                ...(state.tableData?.rows || []),
                ...(output.data?.rows || []),
              ],
              totalCount:
                state.tableData?.totalCount ?? output.data?.totalCount ?? null,
            },
            nextBucketPageNumber: output.data
              ? state.nextBucketPageNumber + 1
              : state.nextBucketPageNumber,
          }));
        },
      }),
    [doQuery, state.nextBucketPageNumber, backendPageSize, search]
  );

  const applySearch = () => {
    setState({
      error: null,
      loading: false,
      tableData: null,
      nextBucketPageNumber: 0,
    });
  };

  // To pevent interrupting the animation of loading by batches
  const [showLoading, setShowLoading] = useState(loading.current);

  useEffect(() => {
    const backendHasMoreRows =
      (state.tableData?.totalCount || 0) > (state.tableData?.rows?.length || 0);

    const endReached =
      (viewPageNumber + 1) * viewPageSize >=
      (state.tableData?.rows?.length || 0);

    const loadNext = (endReached || eager) && backendHasMoreRows;

    if (!state.tableData && !state.loading && !state.error) {
      loading.current || load();
      setShowLoading(true);
      return;
    }

    if (loadNext && !state.loading && !state.error) {
      loading.current || load();
      setShowLoading(true);
    }

    setShowLoading(state.loading || loading.current);
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

  const progress = Math.ceil(
    state.tableData?.totalCount != null
      ? state.tableData?.totalCount === 0
        ? 100
        : ((state.tableData.rows?.length || 0) / state.tableData.totalCount) *
          100
      : 0
  );

  const loadingStatus = showLoading ? (
    <Box pl={2}>
      <CircularProgress />
    </Box>
  ) : state.error ? (
    <Alert severity="error">Cannot load table: {state.error}</Alert>
  ) : (
    <Box />
  );

  const loadingProgress = (
    <LinearProgress
      color="inherit"
      variant={state.tableData || state.error ? 'determinate' : 'indeterminate'}
      value={progress}
    />
  );

  return (
    <Box height="100%" mt={2}>
      <Box
        display="flex"
        flexDirection={'row'}
        justifyContent="space-between"
        mb={2}
      >
        {loadingStatus}

        <Box justifySelf={'flex-end'}>
          <Search
            onChange={(input) => setSearch(input)}
            onClick={applySearch}
          />
        </Box>
      </Box>

      {loadingProgress}

      {state.tableData && (
        <Box
          className="ag-theme-alpine"
          style={{ height: 'calc(100% - 100px)' }} // for table footer
        >
          <Box
            style={{
              height: '100%',
              width: '100%',
            }}
          >
            <AgGridReact
              rowData={rowsWithPlaceholders}
              columnDefs={columnDefs}
              pagination={true}
              paginationPageSize={viewPageSize}
              onPaginationChanged={(e) => {
                const currentPage = e.api.paginationGetCurrentPage();
                setViewPageNumber(currentPage);
              }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};

const Search = (props: {
  onClick: () => void;
  onChange: (input: string) => void;
  disabled?: boolean;
}) => {
  return (
    <TextField
      disabled={props.disabled}
      id="outlined-basic"
      label="Search"
      variant="outlined"
      onChange={(e) => {
        props.onChange(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          props.onClick();
        }
      }}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              color="primary"
              aria-label="apply search"
              component="label"
              onClick={props.onClick}
            >
              <SearchIcon />
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
};

export { TableLoader };
