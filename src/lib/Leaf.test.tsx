import React, { useState } from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { Leaf, Validator } from './Leaf'
import { TextInput } from '../TextInput'
import { useValidationModel, getAllErrorsForLocation, isValidationInProgress } from './hooks/useValidationModel';
import { ValidationModel } from './models';

test("can read/edit leafs nested in object/arrays via composed location", () => {
    const Wrapper = () => {
        const [model, setModel] = useState({
            lists: {
                emails: [
                    { email: "stewie1570@gmail.com" },
                    { email: "something_at_something.com" }
                ]
            }
        });

        return <Leaf model={model} onChange={setModel} location="lists.emails">
            {(emailNodes: Array<any>, setEmailNodes) => emailNodes.map((emailNode, index) => <Leaf
                key={index}
                model={model}
                onChange={setModel}
                location={`lists.emails.${index}.email`}>
                {(email: string, onChange) => <TextInput
                    data-testid={`email${index}`}
                    value={email}
                    onChange={onChange} />}
            </Leaf>)}
        </Leaf>
    }

    const { getByTestId } = render(<Wrapper />);

    expect((getByTestId("email0") as HTMLInputElement).value).toBe("stewie1570@gmail.com");
    expect((getByTestId("email1") as HTMLInputElement).value).toBe("something_at_something.com");
    fireEvent.change(getByTestId("email1"), { target: { value: "stewie1570@hotmail.com" } });
    expect((getByTestId("email0") as HTMLInputElement).value).toBe("stewie1570@gmail.com");
    expect((getByTestId("email1") as HTMLInputElement).value).toBe("stewie1570@hotmail.com");
});

test("can compose Leafs via passing parent location into child location string composition", () => {
    const Wrapper = () => {
        const [model, setModel] = useState({
            lists: {
                emails: [
                    { email: "stewie1570@gmail.com" },
                    { email: "something_at_something.com" }
                ]
            }
        });

        return <Leaf model={model} onChange={setModel} location="lists.emails">
            {(emailNodes: Array<any>, setEmails, onBlur, errors, parentLocation) =>
                emailNodes.map((emailNode, index) => <Leaf
                    key={index}
                    model={model}
                    onChange={setModel}
                    location={`${parentLocation}.${index}.email`}>
                    {(email: string, onChange) => <TextInput
                        data-testid={`email${index}`}
                        value={email}
                        onChange={onChange} />}
                </Leaf>)}
        </Leaf>
    }

    const { getByTestId } = render(<Wrapper />);

    expect((getByTestId("email0") as HTMLInputElement).value).toBe("stewie1570@gmail.com");
    expect((getByTestId("email1") as HTMLInputElement).value).toBe("something_at_something.com");
    fireEvent.change(getByTestId("email1"), { target: { value: "stewie1570@hotmail.com" } });
    expect((getByTestId("email0") as HTMLInputElement).value).toBe("stewie1570@gmail.com");
    expect((getByTestId("email1") as HTMLInputElement).value).toBe("stewie1570@hotmail.com");
});

test("uses failOverLocations when location in model is undefined", () => {
    const Wrapper = (props: { modelReporter: (model: any) => void }) => {
        const [model, setModel] = useState({
            second: {
                backupLocation: "correct"
            },
            third: {
                backupLocation: "wrong, I'm the third one"
            }
        });

        return <>
            <Leaf
                model={model}
                onChange={setModel}
                location="original.location"
                failOverLocations={["first.backupLocation", "second.backupLocation", "third.backupLocation"]}>
                {(value: string, onChange) => <TextInput value={value} onChange={onChange} data-testid="test-input" />}
            </Leaf>
            <button onClick={() => props.modelReporter(model)}>Report Model</button>
        </>;
    }

    let receivedModel;
    const { getByTestId, getByText } = render(<Wrapper modelReporter={model => { receivedModel = model; }} />);

    expect((getByTestId("test-input") as HTMLInputElement).value).toBe("correct");
    fireEvent.change(getByTestId("test-input"), { target: { value: "updated value" } });
    expect((getByTestId("test-input") as HTMLInputElement).value).toBe("updated value");
    getByText("Report Model").click();
    expect(receivedModel).toEqual({
        original: {
            location: "updated value"
        },
        second: {
            backupLocation: "correct"
        },
        third: {
            backupLocation: "wrong, I'm the third one"
        }
    });
});

test("build an empty model with leafs", async () => {
    const Wrapper = () => {
        const [model, setModel] = useState({});

        return <Leaf
            model={model}
            onChange={setModel}
            location="contact.email">
            {(email: string, onChange) => <>
                <TextInput value={email} onChange={onChange} data-testid="email" />
            </>}
        </Leaf>
    }

    const { getByTestId } = render(<Wrapper />);

    expect((getByTestId("email") as HTMLInputElement).value).toBe("");
    fireEvent.change(getByTestId("email"), { target: { value: "stewie1570@gmail.com" } });
    expect((getByTestId("email") as HTMLInputElement).value).toBe("stewie1570@gmail.com");
});

test("validate model node and show errors on blur", async () => {
    const Wrapper = () => {
        const [model, setModel] = useState({ contact: { email: "stewie1570@gmail.com" } });
        const validationModel = useValidationModel();

        const isRequired = (value: string) => (!value || value.trim() === "") && ["Value is required"];

        return <Leaf
            model={model}
            onChange={setModel}
            location="contact.email"
            validationModel={validationModel}
            validators={[isRequired]}>
            {(email: string, onChange, onBlur, errors) => <>
                <TextInput value={email} onChange={onChange} onBlur={onBlur} data-testid="email" />
                {errors.length > 0 && <ul>
                    {errors.map((error, index) => <li data-testid="error" key={index}>{error}</li>)}
                </ul>}
            </>}
        </Leaf>
    }

    const { getByTestId, queryAllByTestId, findAllByTestId } = render(<Wrapper />);

    expect(queryAllByTestId("error").map(node => node.textContent)).toEqual([]);
    fireEvent.change(getByTestId("email"), { target: { value: "" } });
    expect(queryAllByTestId("error").map(node => node.textContent)).toEqual([]);
    fireEvent.blur(getByTestId("email"));
    expect((await findAllByTestId("error")).map(node => node.textContent)).toEqual(["Value is required"]);
});

test("validate model asynchronously and show errors on blur", async () => {
    let resolver = () => { };

    const Wrapper = () => {
        const [model, setModel] = useState({ contact: { email: "stewie1570@gmail.com" } });
        const validationModel = useValidationModel();

        const isValid = async (value: string) => {
            if (value === "second")
                return Promise.resolve(`"${value}" is invalid.`);

            if (value === "first")
                return new Promise(resolve => { resolver = () => resolve(value) });
        };

        return <Leaf
            model={model}
            onChange={setModel}
            location="contact.email"
            validationModel={validationModel}
            validators={[isValid]}>
            {(email: string, onChange, onBlur, errors) => <>
                <TextInput value={email} onChange={onChange} onBlur={onBlur} data-testid="email" />
                {errors.length > 0 && <ul>
                    {errors.map((error, index) => <li data-testid="error" key={index}>{error}</li>)}
                </ul>}
            </>}
        </Leaf>
    }

    const { getByTestId, findAllByTestId } = render(<Wrapper />);

    fireEvent.change(getByTestId("email"), { target: { value: "first" } });
    fireEvent.blur(getByTestId("email"));
    fireEvent.change(getByTestId("email"), { target: { value: "second" } });
    fireEvent.blur(getByTestId("email"));
    resolver();
    expect((await findAllByTestId("error")).map(node => node.textContent)).toEqual(['"second" is invalid.']);
});

test("validate model asynchronously on an interval and show errors on blur", async () => {
    let resolver = () => { };

    const Wrapper = () => {
        const [model, setModel] = useState({ contact: { email: "stewie1570@gmail.com" } });
        const validationModel = useValidationModel();

        const isValid = async (value: string) => {
            if (value === "second")
                return Promise.resolve(`"${value}" is invalid.`);

            if (value === "first")
                return new Promise(resolve => { resolver = () => resolve(value) });
        };

        return <Leaf
            model={model}
            onChange={setModel}
            location="contact.email"
            validationModel={validationModel}
            deferredValidators={[isValid]}>
            {(email: string, onChange, onBlur, errors) => <>
                <TextInput value={email} onChange={onChange} onBlur={onBlur} data-testid="email" />
                {errors.length > 0 && <ul>
                    {errors.map((error, index) => <li data-testid="error" key={index}>{error}</li>)}
                </ul>}
            </>}
        </Leaf>
    }

    const { getByTestId, findAllByTestId } = render(<Wrapper />);

    fireEvent.change(getByTestId("email"), { target: { value: "first" } });
    fireEvent.blur(getByTestId("email"));
    fireEvent.change(getByTestId("email"), { target: { value: "second" } });
    fireEvent.blur(getByTestId("email"));
    resolver();
    expect((await findAllByTestId("error")).map(node => node.textContent)).toEqual(['"second" is invalid.']);
});

test("deferredValidators and validators work together", async () => {
    let validationModel: ValidationModel = {
        set: () => undefined,
        setNamespacesCurrentlyValidating: () => { }
    };

    const Wrapper = () => {
        const [model, setModel] = useState({ contact: { email: "stewie1570@gmail.com" } });
        validationModel = useValidationModel();

        const willBeInvalid = (value: string) => Promise.resolve([`${value} resolved invalid`]);
        const isInvalid = (value: string) => `${value} is invalid`;

        return <Leaf
            model={model}
            onChange={setModel}
            location="contact.email"
            validationModel={validationModel}
            validators={[isInvalid]}
            deferredValidators={[willBeInvalid]}>
            {(email: string, onChange, onBlur, errors) => <>
                <TextInput value={email} onChange={onChange} onBlur={onBlur} data-testid="email" />
                {errors.length > 0 && <ul>
                    {errors.map((error, index) => <li data-testid="error" key={index}>{error}</li>)}
                </ul>}
            </>}
        </Leaf>
    }

    const { getByTestId, getAllByTestId, findByText } = render(<Wrapper />);

    fireEvent.change(getByTestId("email"), { target: { value: "test value" } });
    fireEvent.blur(getByTestId("email"));
    await findByText("test value resolved invalid");
    expect((await getAllByTestId("error")).map(node => node.textContent)).toEqual([
        "test value is invalid",
        "test value resolved invalid"
    ]);
    expect(getAllErrorsForLocation().from(validationModel)).toEqual([{
        location: "contact.email",
        messages: ["test value is invalid", "test value resolved invalid"]
    }]);
});

test("knowing when (async) validation is in progress", async () => {
    let validationModel: ValidationModel = {
        set: () => undefined,
        setNamespacesCurrentlyValidating: () => { }
    };

    const Wrapper = () => {
        const [model, setModel] = useState({ contact: { email: "stewie1570@gmail.com" } });
        validationModel = useValidationModel();

        const willBeInvalid = (value: string) => Promise.resolve([`${value} resolved invalid`]);

        return <Leaf
            model={model}
            onChange={setModel}
            location="contact.email"
            validationModel={validationModel}
            validators={[willBeInvalid]}
            deferredValidators={[willBeInvalid]}>
            {(email: string, onChange, onBlur, errors) => <>
                <TextInput value={email} onChange={onChange} onBlur={onBlur} data-testid="email" />
                {errors.length > 0 && <ul>
                    {errors.map((error, index) => <li data-testid="error" key={index}>{error}</li>)}
                </ul>}
            </>}
        </Leaf>
    }

    const { getByTestId, getAllByText } = render(<Wrapper />);

    expect(isValidationInProgress.in(validationModel)).toBe(true);

    fireEvent.blur(getByTestId("email"));

    await waitFor(() => {
        expect(getAllByText("stewie1570@gmail.com resolved invalid").length).toBe(2);
    });
    expect(isValidationInProgress.in(validationModel)).toBe(false);
});

test("knowing when (async) deferred-only validation is in progress", async () => {
    let validationModel: ValidationModel = {
        set: () => undefined,
        setNamespacesCurrentlyValidating: () => { }
    };

    const Wrapper = () => {
        const [model, setModel] = useState({ contact: { email: "stewie1570@gmail.com" } });
        validationModel = useValidationModel();

        const willBeInvalid = (value: string) => Promise.resolve([`${value} resolved invalid`]);

        return <Leaf
            model={model}
            onChange={setModel}
            location="contact.email"
            validationModel={validationModel}
            deferredValidators={[willBeInvalid]}>
            {(email: string, onChange, onBlur, errors) => <>
                <TextInput value={email} onChange={onChange} onBlur={onBlur} data-testid="email" />
                {errors.length > 0 && <ul>
                    {errors.map((error, index) => <li data-testid="error" key={index}>{error}</li>)}
                </ul>}
            </>}
        </Leaf>
    }

    const { getByTestId, findByText } = render(<Wrapper />);

    await waitFor(() => expect(isValidationInProgress.in(validationModel)).toBe(true));

    fireEvent.blur(getByTestId("email"));

    await findByText("stewie1570@gmail.com resolved invalid");
    expect(isValidationInProgress.in(validationModel)).toBe(false);
});

test("does not show validating during validation deferrement when there's no deferred validators", async () => {
    let validationModel: ValidationModel = {
        set: () => undefined,
        setNamespacesCurrentlyValidating: () => { }
    };

    const Wrapper = () => {
        const [model, setModel] = useState({ contact: { email: "stewie1570@gmail.com" } });
        validationModel = useValidationModel();

        const isInvalid = (value: string) => [`${value} resolved invalid`];

        return <Leaf
            model={model}
            onChange={setModel}
            location="contact.email"
            validationModel={validationModel}
            validators={[isInvalid]}>
            {(email: string, onChange, onBlur, errors) => <>
                <TextInput value={email} onChange={onChange} onBlur={onBlur} data-testid="email" />
                {errors.length > 0 && <ul>
                    {errors.map((error, index) => <li data-testid="error" key={index}>{error}</li>)}
                </ul>}
            </>}
        </Leaf>
    }

    const { getByTestId, findByText } = render(<Wrapper />);

    fireEvent.blur(getByTestId("email"));
    expect(isValidationInProgress.in(validationModel)).toBe(true);

    await Promise.resolve();

    await findByText("stewie1570@gmail.com resolved invalid");
    expect(isValidationInProgress.in(validationModel)).toBe(false);
});

test("validate model immediately show errors", async () => {
    const Wrapper = () => {
        const [model, setModel] = useState({ contact: { email: "" } });
        const validationModel = useValidationModel();

        const isRequired = (value: string) => (!value || value.trim() === "") && ["Value is required"];

        return <Leaf
            showErrors
            model={model}
            onChange={setModel}
            location="contact.email"
            validationModel={validationModel}
            validators={[isRequired]}>
            {(email: string, onChange, onBlur, errors) => <>
                <TextInput value={email} onChange={onChange} onBlur={onBlur} />
                {errors.length > 0 && <ul>
                    {errors.map((error, index) => <li data-testid="error" key={index}>{error}</li>)}
                </ul>}
            </>}
        </Leaf>
    }

    const { findAllByTestId } = render(<Wrapper />);

    expect((await findAllByTestId("error")).map(node => node.textContent)).toEqual(["Value is required"]);
});

test("validate multiple model nodes", async () => {
    const Wrapper = () => {
        const [model, setModel] = useState({ contact: { firstName: "", lastName: "" } });
        const validationModel = useValidationModel();

        const isRequired = (value: string) => (!value || value.trim() === "") && ["Value is required"];

        return <>
            <Leaf
                showErrors
                model={model}
                onChange={setModel}
                location="contact.firstName"
                validationModel={validationModel}
                validators={[isRequired]}>
                {(email: string, onChange, onBlur, errors) => <>
                    <TextInput value={email} onChange={onChange} onBlur={onBlur} data-testid="firstName" />
                    {errors.length > 0 && <ul>
                        {errors.map((error, index) => <li data-testid="error" key={index}>{error}</li>)}
                    </ul>}
                </>}
            </Leaf>
            <Leaf
                showErrors
                model={model}
                onChange={setModel}
                location="contact.lastName"
                validationModel={validationModel}
                validators={[isRequired]}>
                {(email: string, onChange, onBlur, errors) => <>
                    <TextInput value={email} onChange={onChange} onBlur={onBlur} data-testid="lastName" />
                    {errors.length > 0 && <ul>
                        {errors.map((error, index) => <li data-testid="error" key={index}>{error}</li>)}
                    </ul>}
                </>}
            </Leaf>
            <ul>
                {getAllErrorsForLocation("").from(validationModel).map((error, index) => <li key={index} data-testid="top-level-error">
                    {error.location} - {error.messages}
                </li>)}
            </ul>
        </>
    }

    const { getByTestId, getAllByTestId, findAllByTestId, queryAllByTestId } = render(<Wrapper />);

    expect((await findAllByTestId("error")).map(node => node.textContent)).toEqual([
        "Value is required",
        "Value is required"
    ]);
    expect(getAllByTestId("top-level-error").map(node => node.textContent)).toEqual([
        "contact.firstName - Value is required",
        "contact.lastName - Value is required"
    ]);

    fireEvent.change(getByTestId("firstName"), { target: { value: "Stewart" } });
    fireEvent.change(getByTestId("lastName"), { target: { value: "Anderson" } });

    await waitFor(() => {
        expect(queryAllByTestId("error").map(node => node.textContent)).toEqual([]);
        expect(queryAllByTestId("top-level-error").map(node => node.textContent)).toEqual([]);
    });
});

test("get errors for root location via undefined location", async () => {
    const Wrapper = () => {
        const [model, setModel] = useState({ contact: { firstName: "", lastName: "" } });
        const validationModel = useValidationModel();

        const isRequired = (value: string) => (!value || value.trim() === "") && ["Value is required"];

        return <>
            <Leaf
                showErrors
                model={model}
                onChange={setModel}
                location="contact.firstName"
                validationModel={validationModel}
                validators={[isRequired]}>
                {(email: string, onChange, onBlur, errors) => <>
                    <TextInput value={email} onChange={onChange} onBlur={onBlur} data-testid="firstName" />
                </>}
            </Leaf>
            <Leaf
                showErrors
                model={model}
                onChange={setModel}
                location="contact.lastName"
                validationModel={validationModel}
                validators={[isRequired]}>
                {(email: string, onChange, onBlur, errors) => <>
                    <TextInput value={email} onChange={onChange} onBlur={onBlur} data-testid="lastName" />
                </>}
            </Leaf>
            <ul>
                {getAllErrorsForLocation().from(validationModel).map((error, index) => <li key={index} data-testid="top-level-error">
                    {error.location} - {error.messages}
                </li>)}
            </ul>
        </>
    }

    const { getByTestId, findAllByTestId, queryAllByTestId } = render(<Wrapper />);

    expect((await findAllByTestId("top-level-error")).map(node => node.textContent)).toEqual([
        "contact.firstName - Value is required",
        "contact.lastName - Value is required"
    ]);

    fireEvent.change(getByTestId("firstName"), { target: { value: "Stewart" } });
    fireEvent.change(getByTestId("lastName"), { target: { value: "Anderson" } });

    await waitFor(() => {
        expect(queryAllByTestId("top-level-error").map(node => node.textContent)).toEqual([]);
    });
});

test.skip("does not re-render when leaf value and state has not changed", async () => {
    let renders: Array<string> = [];

    const Wrapper = () => {
        const [model, setModel] = useState({
            person: {
                firstName: "Stewart",
                lastName: "Anderson"
            }
        });
        const validationModel = useValidationModel();
        const isRequired: Validator<any> = value => Promise.resolve(['is required']);


        const firstName = React.useMemo(() => (
            firstName: any,
            updateFirstName: (updatedModel: any) => void,
            onBlur: () => any,
            errors: Array<string>
        ): JSX.Element => {
            renders.push("firstName");
            return <>
                <TextInput
                    data-testid="firstName"
                    value={firstName}
                    onChange={updateFirstName} />
                <ul>{errors.map(error => <li key={error}>{error}</li>)}</ul>
            </>;
        }, []);

        const lastName = React.useMemo(() => (
            lastName: any,
            updateLastName: (updatedModel: any) => void,
            onBlur: () => any,
            errors: Array<string>
        ): JSX.Element => {
            renders.push("lastName");
            return <>
                <TextInput
                    data-testid="lastName"
                    value={lastName}
                    onChange={updateLastName} />
                <ul>{errors.map(error => <li key={error}>{error}</li>)}</ul>
            </>;
        }, []);

        return <>
            <Leaf
                showErrors
                location="person.firstName"
                model={model}
                onChange={setModel}
                validationModel={validationModel}
                deferMilliseconds={10}
                deferredValidators={[isRequired]}>
                {firstName}
            </Leaf>
            <Leaf
                showErrors
                location="person.lastName"
                model={model}
                onChange={setModel}
                validationModel={validationModel}
                deferMilliseconds={10}
                deferredValidators={[isRequired]}>
                {lastName}
            </Leaf>
        </>;
    }

    const { getByTestId, getByDisplayValue, getAllByText } = render(<Wrapper />);

    fireEvent.change(getByTestId("firstName"), { target: { value: "John" } });
    fireEvent.change(getByTestId("firstName"), { target: { value: "Stewie" } });
    fireEvent.change(getByTestId("firstName"), { target: { value: "Stewart" } });
    fireEvent.change(getByTestId("lastName"), { target: { value: "Smith" } });

    await waitFor(() => {
        expect(getAllByText("is required").length).toBe(2);
    });

    expect(renders).toEqual([
        "firstName",
        "lastName",
        "firstName",
        "firstName",
        "firstName",
        "lastName"
    ]);
    getByDisplayValue("Stewart");
    getByDisplayValue("Smith");
});