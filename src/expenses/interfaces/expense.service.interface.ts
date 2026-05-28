import { ExpenseDocument } from '../schemas/expense.schema';

export interface IExpenseService {
  findAll(companyId?: string): Promise<ExpenseDocument[]>;
  findOne(id: string): Promise<ExpenseDocument | null>;
}
