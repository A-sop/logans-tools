import { readFile } from 'fs/promises';
import path from 'path';
import { SOPsClient } from './sops-client';

export interface SOP {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

async function getSOPs(): Promise<SOP[]> {
  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'sops.json');
    const data = await readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export default async function SOPsPage() {
  const sops = await getSOPs();

  return <SOPsClient initialSOPs={sops} />;
}
