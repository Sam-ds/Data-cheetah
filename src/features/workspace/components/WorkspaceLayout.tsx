import { Group, Panel, Separator } from 'react-resizable-panels'
import { useFilesStore } from '@/features/files/store/filesStore'
import { useWorkspaceStore } from '@/features/workspace/store/workspaceStore'
import { FileSidebar } from '@/features/files/components/FileSidebar'
import { SqlEditor } from '@/features/sql/components/SqlEditor'
import { ResultsGrid } from '@/features/sql/components/ResultsGrid'
import { DataExplorer } from '@/features/explorer/components/DataExplorer'
import { ChartPanel } from '@/features/charts/components/ChartPanel'
import { ProfilePanel } from '@/features/profiling/components/ProfilePanel'
import { TopToolbar } from './TopToolbar'
import { StatusBar } from '@/components/StatusBar'
import { EmptyState } from './EmptyState'
import { useSqlEditor } from '@/features/sql/hooks/useSqlEditor'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table2, LineChart, Compass, BarChart3 } from 'lucide-react'

export function WorkspaceLayout() {
  const files = useFilesStore((s) => s.files)
  const {
    activeBottomTab,
    setActiveBottomTab,
    activeRightTab,
    setActiveRightTab,
    sidebarCollapsed,
  } = useWorkspaceStore()
  const { runQuery } = useSqlEditor()
  const hasFiles = files.length > 0

  if (!hasFiles) {
    return (
      <div className="flex h-full flex-col">
        <TopToolbar />
        <EmptyState />
        <StatusBar />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <TopToolbar />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {!sidebarCollapsed && (
          <aside className="flex w-44 shrink-0 flex-col border-r sidebar-bg">
            <FileSidebar />
          </aside>
        )}

        <div className="min-w-0 flex-1 overflow-hidden">
          <Group orientation="vertical" className="h-full">
            <Panel id="top-v3" defaultSize={42} minSize={20}>
              <Group orientation="horizontal" className="h-full">
                <Panel id="sql-v3" defaultSize={68} minSize={40}>
                  <SqlEditor onRun={runQuery} />
                </Panel>
                <Separator />
                <Panel id="explore-v3" defaultSize={32} minSize={20}>
                  <Tabs
                    value={activeRightTab}
                    onValueChange={(v) => setActiveRightTab(v as 'explorer' | 'statistics')}
                    className="flex h-full flex-col"
                  >
                    <div className="flex items-center border-b bg-[var(--panel-header)] px-2">
                      <TabsList className="h-8 bg-transparent p-0">
                        <TabsTrigger
                          value="explorer"
                          className="gap-1.5 data-[state=active]:shadow-none"
                        >
                          <Compass className="h-3.5 w-3.5" />
                          Explorer
                        </TabsTrigger>
                        <TabsTrigger
                          value="statistics"
                          className="gap-1.5 data-[state=active]:shadow-none"
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                          Stats
                        </TabsTrigger>
                      </TabsList>
                    </div>
                    <TabsContent value="explorer" className="mt-0 flex-1 overflow-hidden">
                      <DataExplorer embedded />
                    </TabsContent>
                    <TabsContent value="statistics" className="mt-0 flex-1 overflow-hidden">
                      <ProfilePanel embedded />
                    </TabsContent>
                  </Tabs>
                </Panel>
              </Group>
            </Panel>

            <Separator />

            <Panel id="bottom-v3" defaultSize={58} minSize={28}>
              <Tabs
                value={activeBottomTab}
                onValueChange={(v) => setActiveBottomTab(v as 'results' | 'charts')}
                className="flex h-full flex-col"
              >
                <div className="flex items-center border-b bg-[var(--panel-header)] px-2">
                  <TabsList className="h-8 bg-transparent p-0">
                    <TabsTrigger
                      value="results"
                      className="gap-1.5 data-[state=active]:shadow-none"
                    >
                      <Table2 className="h-3.5 w-3.5" />
                      Results
                    </TabsTrigger>
                    <TabsTrigger
                      value="charts"
                      className="gap-1.5 data-[state=active]:shadow-none"
                    >
                      <LineChart className="h-3.5 w-3.5" />
                      Charts
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="results" className="mt-0 flex-1 overflow-hidden">
                  <ResultsGrid embedded />
                </TabsContent>
                <TabsContent value="charts" className="mt-0 flex-1 overflow-hidden">
                  <ChartPanel embedded />
                </TabsContent>
              </Tabs>
            </Panel>
          </Group>
        </div>
      </div>
      <StatusBar />
    </div>
  )
}
