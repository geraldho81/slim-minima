import { createHash } from "crypto";
import { auth } from "@/lib/auth";
import { getCloudinaryCreds } from "@/lib/cloudinary-config";
import { getCloudinaryFolder } from "@/lib/integration-config";

export async function POST() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const creds = await getCloudinaryCreds();
  if (!creds) {
    return Response.json(
      { error: "Cloudinary is not connected. Add your credentials in Settings or set the CLOUDINARY_* environment variables." },
      { status: 400 }
    );
  }
  const { cloudName, apiKey, apiSecret } = creds;

  const folder = await getCloudinaryFolder();
  const timestamp = Math.floor(Date.now() / 1000);
  // Cloudinary signature: sha1 of the sorted params + API secret
  const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = createHash("sha1").update(toSign).digest("hex");

  return Response.json({ cloudName, apiKey, timestamp, signature, folder });
}
