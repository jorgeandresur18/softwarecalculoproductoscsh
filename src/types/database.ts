export type ProductType = 'ampolla' | 'accesorio' | 'solucion' | 'insumo' | 'otro';

export type RecommendationLevel = 'alto' | 'medio' | 'bajo';

export type UserRole = 'admin' | 'staff';

// ── Tablas ───────────────────────────────────────────────────────────

export interface Category {
  id:          string;
  name:        string;
  description: string | null;
  active:      boolean;
  created_at:  string;
}

export interface Product {
  id:                 string;
  product_type:       ProductType;
  provider:           string | null;
  brand:              string | null;
  name:               string;
  compound:           string | null;
  description:        string | null;
  category_id:        string | null;
  conditions_text:    string | null;
  ml:                 number | null;
  measure:            string | null;
  pvm:                number;
  margin_percentage:  number;
  pvp:                number;
  quantity:           number;
  total:              number;
  indications:        string | null;
  observations:       string | null;
  active:             boolean;
  created_at:         string;
  updated_at:         string;
  // Relaciones opcionales (cuando se hace join)
  categories?:        Pick<Category, 'name'> | null;
}

export interface Symptom {
  id:          string;
  name:        string;
  category:    string | null;
  description: string | null;
  active:      boolean;
  created_at:  string;
}

export interface ProductSymptom {
  id:                   string;
  product_id:           string;
  symptom_id:           string;
  recommendation_level: RecommendationLevel;
  reason:               string | null;
  active:               boolean;
  created_at:           string;
  // Relaciones opcionales
  products?:            Pick<Product, 'name' | 'product_type'> | null;
  symptoms?:            Pick<Symptom, 'name'> | null;
}

export interface SerumType {
  id:             string;
  name:           string;
  objective:      string | null;
  description:    string | null;
  base_cost:      number;
  default_margin: number;
  active:         boolean;
  created_at:     string;
  updated_at:     string;
}

export interface SerumProduct {
  id:               string;
  serum_type_id:    string;
  product_id:       string;
  default_quantity: number;
  required:         boolean;
  created_at:       string;
}

export interface CalculationParameter {
  id:          string;
  name:        string;
  key:         string;
  value:       number;
  type:        string | null;
  description: string | null;
  active:      boolean;
  created_at:  string;
  updated_at:  string;
}

export interface Calculation {
  id:                 string;
  patient_reference:  string | null;
  patient_city:       string | null;
  symptoms_text:      string | null;
  serum_type_id:      string | null;
  subtotal_products:  number;
  additional_costs:   number;
  margin_amount:      number;
  discount_amount:    number;
  final_price:        number;
  observations:       string | null;
  created_by:         string | null;
  created_at:         string;
  // Relaciones opcionales
  serum_types?:       Pick<SerumType, 'name'> | null;
}

export interface CalculationItem {
  id:                    string;
  calculation_id:        string;
  product_id:            string | null;
  product_name_snapshot: string;
  quantity:              number;
  unit_price:            number;
  total_price:           number;
  created_at:            string;
}

export interface UserProfile {
  id:         string;
  user_id:    string;
  full_name:  string | null;
  role:       UserRole;
  active:     boolean;
  created_at: string;
}
