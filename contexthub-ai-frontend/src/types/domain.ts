export type Persona = 'Developer' | 'QA' | 'Product' | 'Sales';

export interface FeatureDna {
  name: string;
  riskScore: number;
  businessSummary: string;
  technicalSummary: string;
  apis: string[];
  data: string[];
  qaScenarios: string[];
}
