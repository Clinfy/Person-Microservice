import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PersonsService } from './persons.service';
import { AssignPersonRoleDto } from 'src/interfaces/dto/person.dto';

@Controller()
export class PersonsConsumer {
  constructor(private readonly personsService: PersonsService) {}

  @MessagePattern('person.role_assigned')
  async handleRoleAssigned(@Payload() dto: AssignPersonRoleDto): Promise<void> {
    await this.personsService.updateRoles(dto);
  }
}
