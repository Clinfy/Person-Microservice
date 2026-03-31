export interface IGeoref {
  address_line: string;
  city: string;
  province: string;
  lat: number;
  lon: number;
}

export interface GeorefResponse {
  cantidad: number;
  direcciones: Direccione[];
  inicio: number;
  parametros: Parametros;
  total: number;
}

export interface Direccione {
  altura: DireccioneAltura;
  calle: Calle;
  calle_cruce_1: Calle;
  calle_cruce_2: Calle;
  departamento: Departamento;
  localidad_censal: Departamento;
  nomenclatura: string;
  piso: null;
  provincia: Departamento;
  ubicacion: Ubicacion;
}

export interface DireccioneAltura {
  unidad: null;
  valor: number;
}

export interface Calle {
  categoria: null | string;
  id: null | string;
  nombre: null | string;
}

export interface Departamento {
  id: string;
  nombre: string;
}

export interface Ubicacion {
  lat: number;
  lon: number;
}

export interface Parametros {
  direccion: Direccion;
  localidad_censal: string;
  provincia: string;
}

export interface Direccion {
  altura: DireccionAltura;
  calles: string[];
  piso: null;
  tipo: string;
}

export interface DireccionAltura {
  unidad: null;
  valor: string;
}
