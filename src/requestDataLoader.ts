const refMap = new Map<string, Object>();

const requestDataLoader = <
  ResponseType,
  ResultType,
  loadFncType extends any[] = any[]
>(params: {
  identifier: string;
  initialValue: ResultType;
  doRequest: (...args: loadFncType) => Promise<ResponseType>;
  formatResponse: (result: ResponseType) => ResultType;
  onStateChange: (output: {
    data: ResultType;
    loading: boolean;
    error: Error | null;
  }) => void;
}) => {
  let lastState = {
    loading: false,
    data: params.initialValue,
    error: null,
  };

  const load = async (...args: loadFncType) => {
    const ref = {};
    refMap.set(params.identifier, ref);
    try {
      lastState = {
        loading: true,
        data: params.initialValue,
        error: null,
      };
      refMap.get(params.identifier) === ref && params.onStateChange(lastState);
      const result = await params.doRequest(...args);
      const data = params.formatResponse(result);
      lastState = {
        data,
        loading: false,
        error: null,
      };
      refMap.get(params.identifier) === ref && params.onStateChange(lastState);
    } catch (error: any) {
      lastState = {
        ...lastState,
        loading: false,
        error: error?.message || Error,
      };
      refMap.get(params.identifier) === ref && params.onStateChange(lastState);
    }
  };

  return { load };
};

export { requestDataLoader };
