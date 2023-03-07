import React, {
  JSXElementConstructor,
  ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { requestDataLoader } from './requestDataLoader';
import { AgGridReact } from 'ag-grid-react';
import {
  ColumnMovedEvent,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IsFullWidthRowParams,
  PaginationChangedEvent,
  RowClickedEvent,
  RowHeightParams,
} from 'ag-grid-community';
import 'ag-grid-community/styles//ag-grid.css';
import 'ag-grid-community/styles//ag-theme-alpine.css';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  LinearProgress,
  TextField,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

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

export interface DataLoaderProps<T = any> {
  columns: Field[];
  doQuery: (params: {
    pageSize: number;
    pageNumber: number;
    search: string;
  }) => Promise<{
    totalCount: number | null;
    rows: T[];
  }>;
  /**
   * Start loading all rows immediately
   */
  eager?: boolean;
  /**
   * Page size used in backend queries
   */
  loadPageSize?: number;
  onRowClicked?: (event: { rowData: T; rowIndex: number }) => void;
  /**
   * Makes fields clickable with optional icon.
   *
   * @example
   * {
   *  'field_name': {
   *   endIcon: ForumIcon, // import ForumIcon from '@mui/icons-material/Forum'
   *   handler: (row) => {
   *   console.log(row);
   * }
   */
  detailHandlers?: {
    [key: string]: {
      startIcon?: JSXElementConstructor<any>;
      endIcon?: JSXElementConstructor<any>;
      detailRenderer: (
        row: T,
        /**
         * Call this callback whenever you want to recalculate row height
         *
         * @example
         * const ref = useRef<HTMLDivElement>(null);
         *
         * useEffect(() => {
         *  props.heightChanged();
         * }, [ref.current?.offsetHeight, props]);
         *
         * <Box ref={ref}>
         */
        heightChanged: () => void
      ) => ReactElement | null;
    };
  };
}

// This type is array because AG-Grid reconstructs plain objects passed to cellRendererParams, so passing an object as a ref has no sense
type ExpandedRow = [number | null, ReactElement | null];

type ExpandedCellRendererProps = {
  // Mutable
  expandedRow: ExpandedRow;
  startIcon?: JSXElementConstructor<any>;
  endIcon?: JSXElementConstructor<any>;
};

function ExpandButtonsRenderer<T>(
  props: ExpandedCellRendererProps & {
    value: any;
    valueFormatted: any;
    rowIndex: number;
    data: T;
    api: GridApi;
    detailRenderer: (row: T, f: Function) => ReactElement | null;
  }
) {
  return (
    <Button
      variant="text"
      onClick={() => {
        const rendered = props.detailRenderer(props.data, () => {
          props.api.resetRowHeights();
        });
        if (rendered) {
          props.expandedRow[0] = props.rowIndex;
          props.expandedRow[1] = rendered;

          props.api.resetRowHeights();
          props.api.redrawRows();
        }
      }}
      endIcon={props.endIcon && <props.endIcon />}
      startIcon={props.startIcon && <props.startIcon />}
    >
      {props.valueFormatted ?? props.value}
    </Button>
  );
}

function TableLoader<T>(props: DataLoaderProps<T>) {
  const {
    columns,
    doQuery,
    eager,
    loadPageSize,
    detailHandlers,
    onRowClicked: onRowClickedHandler,
  } = props;
  const [search, setSearch] = useState('');
  const [viewPageSize, setViewPageSize] = useState(15);
  const [viewPageNumber, setViewPageNumber] = useState(0);
  const backendPageSize = loadPageSize || DEFAULT_BACKEND_PAGE_SIZE;
  const loading = useRef(false);

  const expandedRow = useRef<ExpandedRow>([null, null]);

  const columnDefs: GridOptions['columnDefs'] = columns.map((c) => ({
    headerName: c.title,
    field: c.field,
    sortable: true,
    resizable: true,
    filter: true,
    cellRenderer: detailHandlers?.[c.field] ? ExpandButtonsRenderer : undefined,
    cellRendererParams: detailHandlers?.[c.field]
      ? ({
          detailRenderer: detailHandlers[c.field].detailRenderer,
          endIcon: detailHandlers[c.field].endIcon,
          startIcon: detailHandlers[c.field].startIcon,
          expandedRow: expandedRow.current,
        } as ExpandedCellRendererProps)
      : undefined,
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
    viewPageSize,
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
    let missingRowsCount =
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
    <Box visibility={progress === 100 ? 'hidden' : 'visible'}>
      <LinearProgress
        color="inherit"
        variant={
          state.tableData || state.error ? 'determinate' : 'indeterminate'
        }
        value={progress}
      />
    </Box>
  );

  const colState = useRef(null as any);

  const onColumnChange = (event: ColumnMovedEvent<any>) => {
    colState.current = event.columnApi.getColumnState();
  };

  const fullWidthRowStyle = { borderWidth: '0px', height: '50px' };
  const onFullWidthRowGridReady = (event: GridReadyEvent<any>) => {
    event.columnApi.applyColumnState({
      state: colState.current,
      applyOrder: true,
    });

    event.api.sizeColumnsToFit();
  };

  const fullWidthElem = useRef<HTMLElement | null>(null);

  const FullWidthCellRenderer = (event: RowClickedEvent<any>) => {
    // This hook is technically needed bu it has no affect because of AG-Grids internal re-renders
    useEffect(() => {
      event.api.resetRowHeights();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event.api, expandedRow.current[1]]);

    return (
      <Box
        ref={fullWidthElem}
        display="flex"
        justifyContent={'space-between'}
        flexDirection="column"
        alignItems="stretch"
      >
        <Box height="50px" overflow={'hidden'}>
          <AgGridReact
            containerStyle={{
              borderWidth: '0px',
              overflow: 'hidden',
            }}
            rowStyle={fullWidthRowStyle}
            headerHeight={0}
            columnDefs={columnDefs}
            enableCellTextSelection={true}
            onGridReady={onFullWidthRowGridReady}
            rowData={[event.data]}
          />
        </Box>
        {/* Main content goes here */}
        {<Box p={2}>{expandedRow.current[1]}</Box>}
        <Box
          justifySelf={'end'}
          width="100%"
          display="flex"
          justifyContent={'center'}
        >
          <IconButton
            color="primary"
            aria-label="collapse"
            component="label"
            onClick={() => {
              if (event.rowIndex == null) return;

              expandedRow.current[0] = null;
              expandedRow.current[1] = null;

              event.api.resetRowHeights();
              event.api.redrawRows();
            }}
          >
            <ExpandLessIcon />
          </IconButton>
        </Box>
      </Box>
    );
  };

  const getRowHeight = (params: RowHeightParams<any>) => {
    return params.node.rowIndex != null &&
      expandedRow.current?.[0] === params.node.rowIndex
      ? fullWidthElem.current?.offsetHeight || 100
      : 50;
  };

  const onRowClicked = (event: RowClickedEvent<any>) => {
    onRowClickedHandler?.({
      rowData: event.data,
      rowIndex: event.rowIndex!,
    });
  };

  const isFullWidthRow = (params: IsFullWidthRowParams<any>) => {
    if (params.rowNode.rowIndex == null) {
      return false;
    }

    return expandedRow.current?.[0] === params.rowNode.rowIndex;
  };

  const onGridReady = (event: GridReadyEvent<any>) => {
    event.api.sizeColumnsToFit();
    colState.current = event.columnApi.getColumnState();
  };

  const onPaginationChanged = (e: PaginationChangedEvent<any>) => {
    setViewPageSize(e.api.paginationGetPageSize());
    setViewPageNumber(e.api.paginationGetCurrentPage());
  };

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
              onGridReady={onGridReady}
              pagination={true}
              paginationPageSize={viewPageSize}
              paginationAutoPageSize={true}
              onPaginationChanged={onPaginationChanged}
              enableCellTextSelection={true}
              getRowHeight={getRowHeight}
              onColumnEverythingChanged={onColumnChange}
              onColumnMoved={onColumnChange}
              onColumnVisible={onColumnChange}
              onColumnResized={onColumnChange}
              onRowClicked={onRowClicked}
              isFullWidthRow={isFullWidthRow}
              fullWidthCellRenderer={FullWidthCellRenderer}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}

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
