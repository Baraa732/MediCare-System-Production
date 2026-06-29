import { ArgumentsHost, ForbiddenException, HttpException } from '@nestjs/common';
import { AiExceptionFilter } from '../src/common/filters/ai-exception.filter';
import { RedactionService } from '../src/ai/security/redaction.service';

describe('AiExceptionFilter booking redaction', () => {
  const filter = new AiExceptionFilter(new RedactionService());

  function createHost(url: string) {
    const json = jest.fn();
    const response = { status: jest.fn().mockReturnValue({ json }) };
    const request = { url };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost;
    return { host, json, response };
  }

  it('redacts UUIDs in booking-assistant forbidden responses', () => {
    const { host, json } = createHost('/v1/ai/patient-booking-assistant');
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    filter.catch(new ForbiddenException(`Denied ${uuid}`), host);
    const body = json.mock.calls[0][0] as { message: string };
    expect(body.message).not.toContain(uuid);
    expect(body.message).toContain('[redacted-id]');
  });

  it('does not alter non-booking routes', () => {
    const { host, json } = createHost('/v1/ai/patient-chat');
    filter.catch(new HttpException('plain error', 400), host);
    expect(json.mock.calls[0][0]).toEqual({
      statusCode: 400,
      message: 'plain error',
    });
  });
});
