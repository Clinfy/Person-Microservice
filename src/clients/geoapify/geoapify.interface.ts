export interface IGeoapify {
  address: string;
  district: string;
  city: string;
  province: string;
  postcode: string;
  lat: number;
  lon: number;
}

export interface GeoapifyResponse {
  results: Result[];
  query: Query;
}

export interface Query {
  text?: string;
  housenumber: string;
  street: string;
  postcode: string;
  city: string;
  state: string;
  country: string;
  parsed?: Query;
  expected_type?: string;
}

export interface Result {
  datasource: Datasource;
  country: string;
  country_code: string;
  state: string;
  county: string;
  state_district: string;
  city: string;
  municipality: string;
  postcode: string;
  district: string;
  street: string;
  housenumber: string;
  iso3166_2: string;
  lon: number;
  lat: number;
  state_code: string;
  result_type: string;
  formatted: string;
  address_line1: string;
  address_line2: string;
  timezone: Timezone;
  plus_code: string;
  plus_code_short: string;
  rank: Rank;
  place_id: string;
  bbox: Bbox;
}

export interface Bbox {
  lon1: number;
  lat1: number;
  lon2: number;
  lat2: number;
}

export interface Datasource {
  sourcename: string;
  attribution: string;
  license: string;
  url: string;
}

export interface Rank {
  importance: number;
  popularity: number;
  confidence: number;
  confidence_city_level: number;
  confidence_street_level: number;
  confidence_building_level: number;
  match_type: string;
}

export interface Timezone {
  name: string;
  offset_STD: string;
  offset_STD_seconds: number;
  offset_DST: string;
  offset_DST_seconds: number;
}