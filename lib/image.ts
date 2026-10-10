// Browser-only helper: shrink a photo to at most 1280 px on its long side and
// turn it into base64 text, so it is small enough to send to the server.
export async function compressImage(file: File): Promise<{ mimeType: string; base64: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { mimeType: "image/jpeg", base64: dataUrl.split(",")[1] };
}

// Browser-only helper: read any file (e.g. a PDF) as base64 text, unchanged.
export async function fileToBase64(file: File): Promise<{ mimeType: string; base64: string }> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return { mimeType: file.type || "application/pdf", base64: dataUrl.split(",")[1] };
}

// Photos are shrunk; PDFs are sent as they are.
export async function prepareFile(file: File) {
  return file.type === "application/pdf" ? fileToBase64(file) : compressImage(file);
}
