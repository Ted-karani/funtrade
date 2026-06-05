export function downloadBlueprintGuide() {
  const a = document.createElement('a');
  a.href = '/MT5-Beginner-Blueprint.html';
  a.download = 'MT5-Beginner-Blueprint.html';
  a.click();
}
