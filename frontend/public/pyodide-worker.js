// Background worker that runs the student's Python with Pyodide.
// It lives in its own thread, so an infinite loop freezes only this worker, never the page.
// The page (usePyodide.js) kills and replaces this worker if a run takes too long.

importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js");

const MAX_OUTPUT_LINES = 500; // stop sending output after this many lines (endless print loops)

let pyodideReady = loadPyodide().then((pyodide) => {
  self.postMessage({ type: "ready" });
  return pyodide;
});

self.onmessage = async (event) => {
  const { id, code } = event.data;
  const pyodide = await pyodideReady;
  let lines = 0;

  // Send printed output to the page as it happens, so the kid sees it even if the run times out.
  const sendLine = (text) => {
    lines += 1;
    if (lines <= MAX_OUTPUT_LINES) self.postMessage({ type: "stdout", id, text });
  };
  pyodide.setStdout({ batched: sendLine });
  pyodide.setStderr({ batched: sendLine });

  // input() would wait forever for typing; tell the kid instead.
  pyodide.setStdin({ stdin: () => { throw new Error("input() is not used in these quests"); } });

  // A fresh, empty set of variables for every run, so old runs can't affect new ones.
  const namespace = pyodide.globals.get("dict")();
  try {
    await pyodide.runPythonAsync(code, { globals: namespace });
    self.postMessage({ type: "done", id, error: "" });
  } catch (err) {
    self.postMessage({ type: "done", id, error: cleanError(String(err.message || err)) });
  } finally {
    namespace.destroy();
  }
};

// Pyodide's error includes its own internal files. Keep only the part about the kid's code:
// from the first line that mentions their program ("<exec>") to the end.
function cleanError(message) {
  const lines = message.split("\n");
  const start = lines.findIndex((line) => line.includes('File "<exec>"'));
  const kept = start === -1 ? lines : lines.slice(start);
  return kept.join("\n").replaceAll('File "<exec>", ', "").trim();
}
