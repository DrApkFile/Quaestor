import { z } from 'zod';
export const roleSchema = z.enum(['deployer', 'business', 'client', 'supplier1', 'supplier2', 'auditor']);
export type Role = z.infer<typeof roleSchema>;
