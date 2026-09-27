import {z} from 'zod';
export const designSchema=z.enum(['navy','blue','warm']).default('navy');
export type DesignId=z.infer<typeof designSchema>;
