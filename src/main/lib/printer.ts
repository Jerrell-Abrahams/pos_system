import { PrinterTypes, ThermalPrinter } from 'node-thermal-printer'

// Validates & normalizes a configured printer interface. Throws a clear, user-facing error for
// the cases node-thermal-printer can't handle as-is: unset, or the `printer:Name` raw-spooler
// mode which requires a native driver (electron-printer/printer) we deliberately don't bundle.
// Only network (tcp://host:port) and serial/file paths (e.g. \\.\COM3) work out of the box.
export function normalizePrinterInterface(interfaceString: string): string {
  const iface = interfaceString.trim()
  if (!iface) throw new Error('No printer configured — set a printer interface in Settings')
  if (iface.toLowerCase().startsWith('printer:')) {
    throw new Error(
      'System-printer mode (printer:Name) is not supported. Use a network address ' +
        '(tcp://192.168.1.50:9100) or a serial/USB port such as \\\\.\\COM3.'
    )
  }
  return iface
}

// Non-throwing predicate for callers (the print queue) that need to decide whether a job is even
// worth queueing. A blank or unsupported interface is a permanent failure — retrying never fixes
// it — so those jobs must be dropped, not looped forever.
export function isPrintableInterface(interfaceString: string): boolean {
  try {
    normalizePrinterInterface(interfaceString)
    return true
  } catch {
    return false
  }
}

function createPrinter(interfaceString: string): ThermalPrinter {
  return new ThermalPrinter({ type: PrinterTypes.EPSON, interface: normalizePrinterInterface(interfaceString) })
}

export async function sendReceipt(interfaceString: string, lines: string[], kickDrawer: boolean): Promise<void> {
  const printer = createPrinter(interfaceString)

  for (const line of lines) printer.println(line)
  printer.cut()
  if (kickDrawer) printer.openCashDrawer()

  await printer.execute()
}

export async function testPrint(interfaceString: string): Promise<void> {
  const printer = createPrinter(interfaceString)

  printer.alignCenter()
  printer.println('Printer test OK')
  printer.println(new Date().toLocaleString())
  printer.cut()

  await printer.execute()
}

export async function testDrawerKick(interfaceString: string): Promise<void> {
  const printer = createPrinter(interfaceString)
  printer.openCashDrawer()
  await printer.execute()
}
