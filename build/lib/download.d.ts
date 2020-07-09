import { EnvironmentConfig } from '../index';
export default function Download(config: EnvironmentConfig, bucketId: string, fileId: string): Promise<{
    name: string;
    data: unknown;
}>;
