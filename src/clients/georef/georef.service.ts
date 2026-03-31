import { HttpStatus, Injectable } from '@nestjs/common';
import { AddressDto, AddressPatchDto } from 'src/interfaces/dto/address.dto';
import axios from 'axios';
import { propagateAxiosError } from 'src/common/utils/propagate-axios-error';
import { GeorefResponse, IGeoref } from 'src/clients/georef/georef.interface';
import { GeorefErrorCodes, GeorefException } from 'src/clients/georef/georef.exception';

@Injectable()
export class GeorefService {
  async normalizeAddress(dto: AddressDto | AddressPatchDto): Promise<IGeoref> {
    let direction: string;

    if (dto.street_two && dto.street_number) {
      throw new GeorefException(
        'Invalid address format. Please provide either street one and street two, or street one and street number, but not both.',
        GeorefErrorCodes.ADDRESS_FORMAT_ERROR,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.street_one && dto.street_two) {
      direction = `${dto.street_one} esquina ${dto.street_two}`;
    } else if (dto.street_one && dto.street_number) {
      direction = `${dto.street_one} ${dto.street_number}`;
    } else {
      throw new GeorefException(
        'Invalid address format. Please provide either street one and street two, or street one and street number.',
        GeorefErrorCodes.ADDRESS_FORMAT_ERROR,
        HttpStatus.BAD_REQUEST,
      );
    }

    const georefApi = await this.georefApi(direction, dto.province, dto.locality);
    const response = await georefApi.get<GeorefResponse>('');

    if (response.data.cantidad === 0) {
      throw new GeorefException('Provided address not found.', GeorefErrorCodes.ADDRESS_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    if (response.data.cantidad > 1) {
      throw new GeorefException(
        'Multiple addresses found. Please provide more specific information.',
        GeorefErrorCodes.ADDRESS_NOT_EXACTLY_MATCHED,
      HttpStatus.BAD_REQUEST
      );
    }
    const data = response.data.direcciones[0];

    return {
      address_line: data.nomenclatura.split(',')[0],
      city: data.localidad_censal.nombre,
      province: data.provincia.nombre,
      lat: data.ubicacion.lat,
      lon: data.ubicacion.lon,
    };
  }

  private async georefApi(direction: string, province: string, locality: string) {
    const georefApi = axios.create({
      baseURL: 'https://apis.datos.gob.ar/georef/api/direcciones',
      timeout: 5000,
    });

    georefApi.interceptors.request.use(
      (config) => {
        config.params = {
          ...config.params,
          direccion: direction,
          provincia: province,
          localidad_censal: locality,
        };
        config.headers.set('Content-Type', 'application/json');

        return config;
      },
      (error) => {
        propagateAxiosError(error);
      },
    );

    georefApi.interceptors.response.use(
      (response) => response,
      (error) => propagateAxiosError(error),
    );

    return georefApi;
  }
}

