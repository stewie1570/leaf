import React, { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { useErrorHandler } from './useErrorHandler'

const StringRejectionErrorsTestApp = () => {
    const { errorHandler, errors, clearError } = useErrorHandler();

    return <>
        <ul>
            {errors.map(error => <li
                onClick={() => clearError(error)}
                key={error.message}
                data-testid="test-error">
                {error.message}
            </li>)}
        </ul>
        <button onClick={() => errorHandler(Promise.reject("message string"))}>
            Reject a promise with message string
        </button>
        <button onClick={() => errorHandler(Promise.reject("second message string"))}>
            Reject a promise with second message string
        </button>
    </>;
}

const ErrorsTestApp = () => {
    const { errorHandler, errors, clearError } = useErrorHandler();

    return <>
        <ul>
            {errors.map(error => <li
                onClick={() => clearError(error)}
                key={error.message}
                data-testid="test-error">
                {error.message}
            </li>)}
        </ul>
        <button onClick={() => errorHandler(Promise.reject(new Error("message string")))}>
            Reject a promise with message string
        </button>
        <button onClick={() => errorHandler(Promise.reject(new Error("second message string")))}>
            Reject a promise with second message string
        </button>
    </>;
}

test("can display and clear unique string rejection errors", async () => {
    render(<StringRejectionErrorsTestApp />);
    (await screen.findByText("Reject a promise with message string")).click();
    (await screen.findByText("Reject a promise with second message string")).click();
    await waitFor(() => expect(screen.getAllByTestId("test-error").map(({ innerHTML }) => innerHTML))
        .toEqual([
            "message string",
            "second message string"
        ]));
    screen.getByText("second message string").click();
    expect((await screen.findAllByTestId("test-error")).map(({ innerHTML }) => innerHTML))
        .toEqual(["message string"]);
});

test("can display and clear unique errors", async () => {
    render(<ErrorsTestApp />);
    (await screen.findByText("Reject a promise with message string")).click();
    (await screen.findByText("Reject a promise with second message string")).click();
    await waitFor(() => expect(screen.getAllByTestId("test-error").map(({ innerHTML }) => innerHTML))
        .toEqual([
            "message string",
            "second message string"
        ]));
    screen.getByText("second message string").click();
    expect((await screen.findAllByTestId("test-error")).map(({ innerHTML }) => innerHTML))
        .toEqual(["message string"]);
});

test("handleError function returns the awaited promise", async () => {
    const App = () => {
        const { errorHandler } = useErrorHandler();
        const [state, setState] = useState("unchanged");
        const performAction = async () => {
            const value = await errorHandler(Promise.resolve("expected value"));
            value && setState(value);
        }

        return <>
            <button onClick={performAction}>Invoke</button>
            <span data-testid="test-value">
                {state}
            </span>
        </>;
    };
    render(<App />);
    screen.getByText("Invoke").click();
    expect((await screen.findByTestId("test-value")).innerHTML).toEqual("expected value");
});

type SubError = {
    message: string,
    subMessage: string
};

test("additional error details are available to be rendered", async () => {
    const App = () => {
        const { errorHandler, errors } = useErrorHandler<SubError>();
        const performAction = () => errorHandler(Promise.reject({
            message: "the message",
            subMessage: "the sub-message"
        }));

        return <>
            <ul>
                {errors.map(error => <li key={error.message}>
                    <b>{error.message}</b>
                    <span>{error.subMessage}</span>
                </li>)}
            </ul>
            <button onClick={performAction}>Invoke</button>
        </>;
    };
    render(<App />);
    screen.getByText("Invoke").click();
    await screen.findByText("the message");
    await screen.findByText("the sub-message");
});

describe("Handler Level Error mapping", () => {
    it("can map error messages from error objects at the handler level", async () => {
        const App = () => {
            const { errorHandler, errors } = useErrorHandler<SubError>();
            const performAction = () => errorHandler(Promise.reject({
                message: "the message",
                subMessage: "the sub-message"
            }), {
                mapMessage: message => `Prefix: ${message}`
            });

            return <>
                <ul>
                    {errors.map(error => <li key={error.message}>
                        <b>{error.message}</b>
                        <span>{error.subMessage}</span>
                    </li>)}
                </ul>
                <button onClick={performAction}>Invoke</button>
            </>;
        };
        render(<App />);
        screen.getByText("Invoke").click();
        await screen.findByText("Prefix: the message");
        screen.getByText("the sub-message");
    });

    it("can map error messages from error strings at the handler level", async () => {
        const App = () => {
            const { errorHandler, errors } = useErrorHandler<SubError>();
            const performAction = () => errorHandler(Promise.reject("the message"), {
                mapMessage: message => `Prefix: ${message}`
            });

            return <>
                <ul>
                    {errors.map(error => <li key={error.message}>
                        <b>{error.message}</b>
                    </li>)}
                </ul>
                <button onClick={performAction}>Invoke</button>
            </>;
        };
        render(<App />);
        screen.getByText("Invoke").click();
        await screen.findByText("Prefix: the message");
    });

    it("can map error objects from error objects at the handler level", async () => {
        const App = () => {
            const { errorHandler, errors } = useErrorHandler<SubError & { view?: any }>();
            const performAction = () => errorHandler(Promise.reject({
                message: "the message",
                subMessage: "the sub-message"
            }), {
                mapError: error => ({
                    ...error,
                    view: <span>Special view for {error.message}</span>
                })
            });

            return <>
                <ul>
                    {errors.map(error => <li key={error.message}>
                        <b>{error.view || error.message}</b>
                        <span>{error.subMessage}</span>
                    </li>)}
                </ul>
                <button onClick={performAction}>Invoke</button>
            </>;
        };
        render(<App />);
        screen.getByText("Invoke").click();
        await screen.findByText("Special view for the message");
        screen.findByText("the sub-message");
    });

    it("can map error objects from error strings at the handler level", async () => {
        const App = () => {
            const { errorHandler, errors } = useErrorHandler<SubError & { view?: any }>();
            const performAction = () => errorHandler(Promise.reject("the message"), {
                mapError: error => ({
                    ...error,
                    view: <span>Special view for {error.message}</span>
                })
            });

            return <>
                <ul>
                    {errors.map(error => <li key={error.message}>
                        <b>{error.view || error.message}</b>
                    </li>)}
                </ul>
                <button onClick={performAction}>Invoke</button>
            </>;
        };
        render(<App />);
        screen.getByText("Invoke").click();
        await screen.findByText("Special view for the message");
    });
});

describe("Hook Level Error mapping", () => {
    it("can map error messages from error objects at the handler level", async () => {
        const App = () => {
            const { errorHandler, errors } = useErrorHandler<SubError>({
                mapMessage: message => `Prefix: ${message}`
            });
            const performAction = () => errorHandler(Promise.reject({
                message: "the message",
                subMessage: "the sub-message"
            }));

            return <>
                <ul>
                    {errors.map(error => <li key={error.message}>
                        <b>{error.message}</b>
                        <span>{error.subMessage}</span>
                    </li>)}
                </ul>
                <button onClick={performAction}>Invoke</button>
            </>;
        };
        render(<App />);
        screen.getByText("Invoke").click();
        await screen.findByText("Prefix: the message");
        screen.getByText("the sub-message");
    });

    it("can map error messages from error strings at the handler level", async () => {
        const App = () => {
            const { errorHandler, errors } = useErrorHandler<SubError>({
                mapMessage: message => `Prefix: ${message}`
            });
            const performAction = () => errorHandler(Promise.reject("the message"));

            return <>
                <ul>
                    {errors.map(error => <li key={error.message}>
                        <b>{error.message}</b>
                    </li>)}
                </ul>
                <button onClick={performAction}>Invoke</button>
            </>;
        };
        render(<App />);
        screen.getByText("Invoke").click();
        await screen.findByText("Prefix: the message");
    });

    it("can map error objects from error objects at the handler level", async () => {
        const App = () => {
            const { errorHandler, errors } = useErrorHandler<SubError & { view?: any }>({
                mapError: error => ({
                    ...error,
                    view: <span>Special view for {error.message}</span>
                })
            });
            const performAction = () => errorHandler(Promise.reject({
                message: "the message",
                subMessage: "the sub-message"
            }));

            return <>
                <ul>
                    {errors.map(error => <li key={error.message}>
                        <b>{error.view || error.message}</b>
                        <span>{error.subMessage}</span>
                    </li>)}
                </ul>
                <button onClick={performAction}>Invoke</button>
            </>;
        };
        render(<App />);
        screen.getByText("Invoke").click();
        await screen.findByText("Special view for the message");
        screen.findByText("the sub-message");
    });

    it("can map error objects from error strings at the handler level", async () => {
        const App = () => {
            const { errorHandler, errors } = useErrorHandler<SubError & { view?: any }>({
                mapError: error => ({
                    ...error,
                    view: <span>Special view for {error.message}</span>
                })
            });
            const performAction = () => errorHandler(Promise.reject("the message"));

            return <>
                <ul>
                    {errors.map(error => <li key={error.message}>
                        <b>{error.view || error.message}</b>
                    </li>)}
                </ul>
                <button onClick={performAction}>Invoke</button>
            </>;
        };
        render(<App />);
        screen.getByText("Invoke").click();
        await screen.findByText("Special view for the message");
    });
});