const requestDataLoader = <
  ResponseType,
  ResultType,
  loadFncType extends any[] = any[]
>(params: {
  initialValue: ResultType;
  doRequest: (...args: loadFncType) => Promise<ResponseType>;
  formatResponse: (result: ResponseType) => ResultType;
  onStateChange: (output: {
    data: ResultType;
    loading: boolean;
    error: string | null;
  }) => void;
}) => {
  let lastState = {
    loading: false,
    data: params.initialValue,
    error: null,
  };

  let lastRef = {};

  const load = async (...args: loadFncType) => {
    const ref = {};
    lastRef = ref;
    try {
      lastState = {
        loading: true,
        data: params.initialValue,
        error: null,
      };
      lastRef === ref && params.onStateChange(lastState);
      const result = await params.doRequest(...args);
      const data = params.formatResponse(result);
      lastState = {
        data,
        loading: false,
        error: null,
      };
      lastRef === ref && params.onStateChange(lastState);
    } catch (error: any) {
      lastState = {
        ...lastState,
        loading: false,
        error: error?.message || Error,
      };
      lastRef === ref && params.onStateChange(lastState);
    }
  };

  return { load };
};

export { requestDataLoader };
