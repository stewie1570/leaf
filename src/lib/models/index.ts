export type Error = {
    location: string;
    messages: Array<string>;
};

export type ValidationModel = {
    set: React.Dispatch<any>,
    get: (location: string) => Array<string>,
    getAllErrorsForLocation: (location?: string, options?: { includeIsValidating?: boolean }) => Array<Error>,
    isValidating: () => boolean
};