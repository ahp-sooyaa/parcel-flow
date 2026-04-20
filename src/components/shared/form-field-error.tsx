type FormFieldErrorProps = {
    message?: string;
};

export function FormFieldError({ message }: Readonly<FormFieldErrorProps>) {
    if (!message) {
        return null;
    }

    return <p className="text-xs text-destructive">{message}</p>;
}
