export class ServiceError extends Error
{
	status: number;

	constructor(message: string, status: number)
	{
		super(message);
		this.name = 'ServiceError';
		this.status = status;
	}
}
