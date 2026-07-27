import { useState } from 'react'
import { Upload, Shield, Zap, Lock } from 'lucide-react'
import logo from '@/assets/logo.png'
import { cn } from '@/lib/utils/cn'
import { useFileImport } from '@/features/files/hooks/useFileImport'
import { Loader2 } from 'lucide-react'

export function EmptyState() {
  const { handleDrop, handleFileInput, importStatus } = useFileImport()
  const isLoading = importStatus === 'loading'
  const [dragging, setDragging] = useState(false)

  return (
    <div className="home-stage flex h-full flex-col items-center justify-center p-8">
      <div className="home-orb home-orb--amber" aria-hidden />
      <div className="home-orb home-orb--sky" aria-hidden />
      <div className="home-orb home-orb--mint" aria-hidden />
      <div className="home-blazes" aria-hidden>
        <span className="home-blaze" />
        <span className="home-blaze" />
        <span className="home-blaze" />
        <span className="home-blaze" />
        <span className="home-blaze" />
      </div>

      <div className="home-content flex w-full max-w-xl flex-col items-center gap-8 text-center">
        <div className="home-logo-frame">
          <img
            src={logo}
            alt="DataCheetah"
            className="home-logo h-40 w-auto max-w-[min(400px,85vw)] rounded-lg object-contain"
          />
        </div>

        <div className="home-fade-up home-fade-up-delay-1 space-y-2">
          <p className="text-base font-medium tracking-tight text-foreground">
            Local-first SQL. Zero upload.
          </p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Drop a dataset and query in seconds — everything runs in your browser.
          </p>
        </div>

        <label
          className={cn(
            'home-drop home-fade-up home-fade-up-delay-2 flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-12',
            isLoading && 'pointer-events-none opacity-60',
            dragging && 'border-[#f2a01f] bg-[rgba(242,160,31,0.08)]',
          )}
          onDrop={(e) => {
            setDragging(false)
            handleDrop(e)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
        >
          <input
            type="file"
            className="hidden"
            accept=".csv,.tsv,.parquet,.json,.jsonl,.xlsx,.xls"
            onChange={handleFileInput}
          />
          {isLoading ? (
            <Loader2 className="h-9 w-9 animate-spin text-[#f2a01f]" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[rgba(242,160,31,0.15)] text-[#f2a01f]">
              <Upload className="h-6 w-6" />
            </div>
          )}
          <p className="mt-4 text-sm font-semibold text-foreground">
            {isLoading ? 'Loading dataset…' : dragging ? 'Release to open' : 'Drop a file or click to browse'}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">CSV · Parquet · JSON · Excel</p>
        </label>

        <div className="home-fade-up home-fade-up-delay-3 flex flex-wrap items-center justify-center gap-2">
          <span className="home-chip home-chip--amber">
            <Zap className="h-3 w-3" />
            Instant SQL
          </span>
          <span className="home-chip home-chip--sky">
            <Lock className="h-3 w-3" />
            Stays on device
          </span>
          <span className="home-chip home-chip--mint">
            <Shield className="h-3 w-3" />
            No account
          </span>
        </div>
      </div>
    </div>
  )
}
