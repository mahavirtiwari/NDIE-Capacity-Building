@{
    # Where the production deployment lives. Everything under deploy\windows
    # reads its defaults from here, so the values are written down once instead
    # of being typed at a prompt at four in the morning.
    #
    # Change a value here, not in the scripts. A script with the host baked into
    # it is a script that only works on the host somebody happened to write it
    # on.

    # The checkout the release is built from.
    SourcePath  = 'E:\NDIE-Capacity-Building-main'

    # Where the built site runs. Emptied and replaced on every release, which
    # is why nothing that must survive one may live inside it.
    SitePath    = 'E:\inetpub\cbms'

    # Uploaded files: coordinator photographs and certificate artwork. Outside
    # the site folder on purpose.
    StorageRoot = 'E:\cbms-data'

    # Where backups are written. A second physical disc is better than a second
    # folder on the same one; better still is a copy that leaves the machine.
    BackupRoot  = 'E:\cbms-backups'

    # How many days of database backups to keep. The most recent is never
    # pruned, whatever this says.
    KeepDays    = 30

    # IIS.
    SiteName    = 'CBMS'
    PoolName    = 'CbmsAppPool'
    HostName    = 'training.ndie.gov.in'

    # What the verification step asks for. Must match the certificate.
    BaseUrl     = 'https://training.ndie.gov.in'

    # The database, as SQL Server knows it. The connection string itself lives
    # in appsettings.Production.json and is never copied here — one place for a
    # password is enough.
    SqlInstance = 'localhost'
    Database    = 'CbmsDb'

    # The hour a scheduled backup runs, on the 24-hour clock.
    BackupAt    = '01:30'
}
