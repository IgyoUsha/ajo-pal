export async function burst(big = false) {
  if (typeof window === "undefined") return;
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#087A41", "#F5B301", "#E6F4EC", "#FDF3D4"];
  confetti({ particleCount: big ? 180 : 70, spread: big ? 110 : 70, origin: { y: 0.7 }, colors });
}
