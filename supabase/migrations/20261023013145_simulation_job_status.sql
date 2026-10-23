-- Job status can be recorded before the queue message carries the job.
alter table footebas.simulation_jobs alter column user_id drop not null;
alter table footebas.simulation_jobs alter column job drop not null;
