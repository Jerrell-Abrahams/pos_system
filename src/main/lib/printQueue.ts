import type { PrintIssueEvent } from '@shared/types'
import { isPrintableInterface, sendReceipt } from './printer'

interface QueuedPrint {
  receiptNo: string
  lines: string[]
  kickDrawer: boolean
  attempts: number
}

const RETRY_INTERVAL_MS = 30_000

const queue: QueuedPrint[] = []
let getInterface: () => string = () => ''
let notify: (event: PrintIssueEvent) => void = () => { }
let flushing = false

export function initPrintQueue(interfaceGetter: () => string, notifyFn: (event: PrintIssueEvent) => void): void {
  getInterface = interfaceGetter
  notify = notifyFn
  setInterval(() => void flushQueue(), RETRY_INTERVAL_MS)
}

export function enqueuePrint(receiptNo: string, lines: string[], kickDrawer: boolean): void {
  // Drop the job when no usable printer is configured. Without this, an unconfigured (blank) or
  // unsupported interface queues a job that can never succeed and retries forever — one dead job
  // per sale, growing the queue unbounded. A genuinely-configured-but-offline printer still gets a
  // valid interface here, so it keeps queueing and retrying as intended. The completed sale never
  // hinges on the printer either way; the Settings "Test print" button surfaces misconfigurations.
  if (!isPrintableInterface(getInterface())) return
  queue.push({ receiptNo, lines, kickDrawer, attempts: 0 })
  void flushQueue()
}

async function flushQueue(): Promise<void> {
  if (flushing) return
  flushing = true
  try {
    while (queue.length > 0) {
      const job = queue[0]
      try {
        await sendReceipt(getInterface(), job.lines, job.kickDrawer)
        queue.shift()
      } catch {
        job.attempts += 1
        // Only notify once per job so a printer that's off for an hour doesn't spam toasts
        // every retry tick; the job stays queued and keeps retrying silently after that.
        if (job.attempts === 1) {
          notify({ kind: 'print-failed', message: `Receipt ${job.receiptNo} could not print — will keep retrying` })
        }
        break // printer is unreachable; stop for now and retry the whole queue next tick
      }
    }
  } finally {
    flushing = false
  }
}
