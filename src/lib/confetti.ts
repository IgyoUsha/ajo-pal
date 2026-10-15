export async function burst(big = false) {
  if (typeof window === "undefined") return;
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#0B8A4A", "#F6C445", "#FF7A59", "#ffffff"];
  confetti({ particleCount: big ? 180 : 70, spread: big ? 110 : 70, origin: { y: 0.7 }, colors });
}
