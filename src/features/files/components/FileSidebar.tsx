import { useFileImport } from '@/features/files/hooks/useFileImport'
import { FileListItem } from './FileListItem'
import { FolderOpen } from 'lucide-react'

export function FileSidebar() {
  const { files, activeFileId, setActiveFile } = useFileImport()

  return (
    <div className="flex h-full flex-col sidebar-bg">
      <div className="panel-header">
        <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
        Files
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {files.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            No files loaded — use Open in the toolbar
          </p>
        ) : (
          <div className="space-y-0.5">
            {files.map((file) => (
              <FileListItem
                key={file.id}
                file={file}
                isActive={file.id === activeFileId}
                onClick={() => setActiveFile(file.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
