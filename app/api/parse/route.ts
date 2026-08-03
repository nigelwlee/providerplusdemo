import { NextResponse } from "next/server";
import { DocumentParseError, parseUploadedFile } from "@/lib/parseDocument";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart file upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }

  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json(
      { error: "That file is larger than 15MB. Please upload a smaller document." },
      { status: 400 }
    );
  }

  try {
    const parsed = await parseUploadedFile(file);
    return NextResponse.json(parsed);
  } catch (error) {
    if (error instanceof DocumentParseError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("File parse failed:", error);
    return NextResponse.json(
      { error: "We couldn't read that file. Please try a different file or paste the text instead." },
      { status: 500 }
    );
  }
}
