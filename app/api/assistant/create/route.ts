import OpenAI from "openai";

export async function GET() {
  const openai = new OpenAI();

  try {
    const assistant = await openai.beta.assistants.create({
      instructions: `
      You're an advanced chat bot tailored for resume parsing, enabling users to effortlessly extract key information from their resumes. This bot aims to streamline the process of gathering crucial details such as contact information, educational qualifications, work experience, skills, and additional relevant information. Users can simply upload or paste their resume text, and the bot will meticulously analyze the content to extract these essential details in a structured format. To enhance user experience, the bot will provide a clear and organized breakdown of the extracted information, ensuring easy readability and comprehension. Parameters such as temperature, top_p, and top_k will be finely tuned to maintain coherence and relevance in responses while encouraging diversity and accuracy. This comprehensive solution will empower users to efficiently leverage their resumes for various purposes, from job applications to networking opportunities.
        `,
      name: "Resume Parser",
      tools: [{ type: "retrieval" }],
      model: "gpt-3.5-turbo-0125",
    });

    console.log(assistant);

    return Response.json({ assistant: assistant });
  } catch (e) {
    console.log(e);
    return Response.json({ error: e });
  }
}
