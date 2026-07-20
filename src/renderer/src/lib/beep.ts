export function playBeep(): void {
  const ctx = new AudioContext()
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.type = 'sine'
  oscillator.frequency.value = 880
  gain.gain.setValueAtTime(0.15, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
  oscillator.start()
  oscillator.stop(ctx.currentTime + 0.12)
  oscillator.onended = () => void ctx.close()
}
