@{
    # Where the production deployment lives. Everything under deploy\windows
    # reads its defaults from here, so the values are written down once instead
    # of being typed at a prompt at four in the morning.
    #
    # Change a value here, not in the scripts. A script with the host baked into
    # it is a script that only works on the host somebody happened to write it
    # on.
    #
    # Production and staging are the same machine. That is worth knowing before
    # a release rather than during one: there is nowhere to try a build first,
    # the backups sit on the box they protect, and 20-release.ps1's "previous
    # build" is the only way back that does not involve a rebuild. Everything
    # below is written for that arrangement.

    # The checkout the release is built from.
    SourcePath  = 'E:\NDIE-Capacity-Building-main'

    # Where the built site runs. Emptied and replaced on every release, which
    # is why nothing that must survive one may live inside it.
    SitePath    = 'E:\inetpub\cbms'

    # Uploaded files: coordinator photographs and certificate artwork. Outside
    # the site folder on purpose.
    StorageRoot = 'E:\cbms-data'

    # Where backups are written.
    #
    # The same disc as the site, for now, which survives a mistake and not a
    # disc. Copying E:\cbms-backups off the machine is still the one thing
    # missing from this deployment; when there is somewhere to put it, point
    # this at that folder or add the copy to the nightly task.
    BackupRoot  = 'E:\cbms-backups'

    # How many days of database backups to keep. The most recent is never
    # pruned, whatever this says.
    KeepDays    = 30

    # IIS. These match what 05-install-iis.ps1 created.
    SiteName    = 'CBMS'
    PoolName    = 'CbmsAppPool'
    HostName    = 'leanstaging.qci.org.in'

    # What the verification step asks for. Must match the certificate.
    BaseUrl     = 'https://leanstaging.qci.org.in'

    # The database, as SQL Server knows it. A named Express instance, not the
    # default one — the service on this machine is MSSQL$SQLEXPRESS, which is
    # also why backups are written without compression: Express does not have
    # it, and 10-backup.ps1 checks the edition rather than assuming.
    #
    # The connection string itself lives in appsettings.Production.json and is
    # never copied here — one place for a password is enough.
    SqlInstance = 'localhost\SQLEXPRESS'
    Database    = 'CbmsDb'

    # The hour a scheduled backup runs, on the 24-hour clock. Before the working
    # day and after any late marking.
    BackupAt    = '01:30'
}
