export async function prepareAvatar(file: File): Promise<File> {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("10MB 이하의 사진을 선택해 주세요.");
  if (
    !/^image\/(jpeg|png|webp|avif|heic|heif)$/.test(file.type) &&
    !/\.(jpe?g|png|webp|avif|heic|heif)$/i.test(file.name)
  )
    throw new Error("JPG, PNG, WebP 등의 사진 파일을 선택해 주세요.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(
          new Error(
            "이 사진을 읽을 수 없어요. JPG 또는 PNG로 다시 선택해 주세요.",
          ),
        );
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error(
        "사진을 처리하지 못했어요. 다른 사진으로 다시 시도해 주세요.",
      );
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    context.fillStyle = "#f4f2ea";
    context.fillRect(0, 0, 256, 256);
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      256,
      256,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("사진을 저장하지 못했어요.")),
        "image/jpeg",
        0.86,
      ),
    );
    return new File([blob], "profile.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
