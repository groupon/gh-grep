export default function getAuthToken(): Promise<{
    token: string;
    host: string;
}>;
