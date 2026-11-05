/** Canvas course files: listing for the import picker. */
import { canvasList, type CanvasFileMeta } from './client';
import type { CanvasConfig } from './config';

export const MAX_CANVAS_FILE_BYTES = 200 * 1024 * 1024;

export interface CanvasFileSummary {
  id: string;
  name: string;
  size: number | null;
  contentType: string | null;
  updatedAt: string | null;
}

export async function listCourseFiles(
  config: CanvasConfig,
  courseId: string,
): Promise<CanvasFileSummary[]> {
  const files = await canvasList<CanvasFileMeta>(
    config,
    `/courses/${courseId}/files`,
    { sort: 'name' },
    10,
  );
  return files
    .filter((file) => !file.locked_for_user && !file.hidden)
    .map((file) => ({
      id: String(file.id),
      name: file.display_name || file.filename || `file-${file.id}`,
      size: typeof file.size === 'number' ? file.size : null,
      contentType: file['content-type'] ?? null,
      updatedAt: file.updated_at ?? null,
    }));
}
