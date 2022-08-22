export default function makeLogger({ json, prefix, buffer, }: {
    json: boolean;
    prefix?: string;
    buffer?: string[];
}): {
    (message: string, data: unknown, tmpLog?: boolean): void;
    tmp(message: string, data: unknown): void;
};
