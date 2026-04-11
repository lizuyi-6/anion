import { NextResponse } from "next/server";

import { resolveRuntimeMode } from "@/lib/env";
import { getViewer } from "@/lib/server/auth";
import { storeUpload } from "@/lib/server/services/uploads";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  "text/plain",
  "text/csv",
  "text/markdown",
  "text/html",
  "application/json",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function POST(request: Request) {
  try {
    const viewer = await getViewer();
    if (!viewer) {
      return NextResponse.json(
        { error: "未授权", message: "请先登录后再上传文件" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "无效请求", message: "未选择任何文件" },
        { status: 400 }
      );
    }

    const invalidFiles: string[] = [];
    const oversizedFiles: string[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        oversizedFiles.push(file.name);
      }
      if (file.size > 0 && !ALLOWED_MIME_TYPES.includes(file.type) && !file.name.match(/\.(txt|csv|md|json|log|pdf|doc|docx)$/i)) {
        invalidFiles.push(file.name);
      }
    }

    if (oversizedFiles.length > 0) {
      return NextResponse.json(
        {
          error: "文件过大",
          message: `以下文件超过10MB限制：${oversizedFiles.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (invalidFiles.length > 0) {
      return NextResponse.json(
        {
          error: "文件类型不支持",
          message: `以下文件类型不支持：${invalidFiles.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const uploads = await Promise.all(
      files.map(async (file) => {
        try {
          return await storeUpload(file, viewer);
        } catch (error) {
          console.error(`上传文件失败 ${file.name}:`, error);
          throw error;
        }
      })
    );

    return NextResponse.json({
      uploads,
      message: `成功上传 ${uploads.length} 个文件`,
    });
  } catch (error) {
    console.error("文件上传错误:", error);

    const runtimeMode = resolveRuntimeMode();
    if (runtimeMode === "demo") {
      return NextResponse.json(
        { error: "上传失败", message: "演示模式下文件上传功能不可用" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "上传失败", message: "文件上传失败，请稍后重试" },
      { status: 500 }
    );
  }
}
