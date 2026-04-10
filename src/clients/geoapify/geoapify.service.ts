import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { propagateAxiosError } from 'src/common/utils/propagate-axios-error';
import { AddressDto } from 'src/interfaces/dto/address.dto';
import { GeoapifyResponse, IGeoapify } from 'src/clients/geoapify/geoapify.interface';

@Injectable()
export class GeoapifyService {
  constructor(
    private readonly configService: ConfigService
  ) {}

  async normalizeAddress (dto: AddressDto): Promise<IGeoapify> {
    const geoapifyApi = await this.geoapifyApi(dto.street_number, dto.street_one, dto.postal_code, dto.locality, dto.province);
    const response = await geoapifyApi.get<GeoapifyResponse>('');
    const data = response.data.results[0];

    return {
      address: data.address_line1,
      district: data.district,
      city: data.city,
      postcode: data.postcode,
      province: data.state,
      lat: data.lat,
      lon: data.lon,
    };
  }
  
  private async geoapifyApi(number: number, street: string, postcode: number, city: string, province: string) {
    const apiKey = this.configService.get<string>('GEOAPIFY_API_KEY');

    const geoapifyApi = axios.create({
      baseURL: 'https://api.geoapify.com/v1/geocode/search',
      timeout: 5000,
    });

    geoapifyApi.interceptors.request.use(
      (config) => {
        config.params = {
          ...config.params,
          housenumber: number,
          street: street,
          postcode: postcode,
          city: city,
          state: province,
          country: 'Argentina',
          lang: 'en',
          limit: 1,
          format: 'json',
          apiKey: apiKey,
        };
        config.headers.set('Content-Type', 'application/json');

        return config;
      },
      (error) => {
        propagateAxiosError(error);
      },
    );

    geoapifyApi.interceptors.response.use(
      (response) => response,
      (error) => propagateAxiosError(error),
    );

    return geoapifyApi;
  }
}