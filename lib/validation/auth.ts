import { z } from "zod";

export const signInSchema = z.object({
  email: z.email({ error: "Enter a valid email address" }),
  password: z.string().min(8, { error: "Password must be at least 8 characters" }),
});

export const signUpSchema = signInSchema.extend({
  fullName: z
    .string()
    .trim()
    .min(2, { error: "Enter your full name" })
    .max(120, { error: "Name is too long" }),
  institution: z
    .string()
    .trim()
    .min(2, { error: "Enter the name of your institution" })
    .max(160, { error: "Institution name is too long" }),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
