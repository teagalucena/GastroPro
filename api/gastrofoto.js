import formidable from "formidable";
import fs from "fs";
import FormData from "form-data";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.end("Method Not Allowed");
  }

  try {
    // Parse do formulário multipart (imagem + texto)
    const form = formidable({ multiples: false });
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
    });

    const prompt = (fields.prompt || fields.text || "").toString().trim();
    const file = files.image || files.file || files.photo;

    if (!prompt) return res.status(400).json({ error: "Missing prompt" });
    if (!file) return res.status(400).json({ error: "Missing image file (field name: image)" });

    const selected = Array.isArray(file) ? file[0] : file;
    const filePath = selected.filepath;
    const fileName = selected.originalFilename || "image.jpg";

    // Monta o FormData para enviar à OpenAI
    const fd = new FormData();
    fd.append("image", fs.createReadStream(filePath), { filename: fileName });
    fd.append("prompt", prompt);
    fd.append("response_format", "url");

    // Chamada à API da OpenAI
    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        ...fd.getHeaders(),
      },
      body: fd,
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error || data });
    }

    const url = data?.data?.[0]?.url;
    if (!url) {
      return res.status(500).json({ error: "OpenAI did not return an image URL." });
    }

    return res.status(200).json({ url });
  } catch (error) {
    console.error("Erro:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
